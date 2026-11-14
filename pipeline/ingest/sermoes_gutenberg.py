"""Ingere comentários por texto do Project Gutenberg: os sermões de Alexander Maclaren (Expositions of Holy Scripture)
e os capítulos de The Expositor's Bible (ed. W. Robertson Nicoll, 1887-1905).

Sermões (Maclaren, OBRAS["maclaren"]): cada sermão vira UMA linha de comentário, no intervalo da passagem do seu
cabeçalho. O texto começa com "Maclaren — <título do volume>: <título do sermão>" e segue com o corpo do sermão
inteiro (sem truncar). A epígrafe (a citação da Escritura, com "--LIVRO cap. v.") não entra: é o texto bíblico que o
app já mostra.

Capítulos (The Expositor's Bible, OBRAS["expositors"]): cada capítulo do volume (ver linhas_de_capitulos) vira uma
linha, com "The Expositor's Bible — <livro> (<autor>): <título do capítulo>" e o corpo inteiro.

Fonte: Project Gutenberg. Maclaren: 15 volumes (eBooks #7069 a #24674). Expositor's Bible: 48 volumes (ver
EXPOSITORS). As obras estão em domínio público (ver DATA_LICENSES.md).

Estrutura do texto (Gutenberg, texto simples):
- Título do sermão em maiúsculas, opcionalmente com a passagem entre parênteses: "GOD'S COVENANT WITH ABRAM
  (Genesis xv. 5-18)". Título de grupo ("ABRAM AND THE LIFE OF FAITH") seguido de outro título é descartado.
- Epígrafe: citação da Escritura que termina em "--GENESIS v. 22." (também "—JOHN vii. 37,38."), às vezes com
  algarismos romanos.
- Corpo: parágrafos em prosa, separados por linha em branco.

Regras (funções puras, testadas em pipeline/tests/test_sermoes_gutenberg.py):
- Cabeçalho do Gutenberg e rodapé, sumário, ornamentos ("* * *") e marcas de ilustração saem.
- Passagem: primeiro o parêntese do título; se não houver passagem válida, o fim da epígrafe. Capítulo romano ou
  arábico (ingest/refparse.py, passagem_cabecalho). Só a primeira referência, se houver ";".
- Descartados, com contagem por motivo no fim: sem_cabecalho (nenhuma passagem), cabecalho_ilegivel (há
  cabeçalho, mas não é uma referência da versificação KJV), sem_texto (sermão sem corpo).

Uso (padrão: maclaren; ou expositors):
    cd pipeline && python3 -I ingest/sermoes_gutenberg.py [maclaren|expositors]
"""

import hashlib
import re
import sys
import time
import urllib.request
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import RAW, StagingWriter, cite_com  # noqa: E402
from ingest.refparse import passagem_cabecalho  # noqa: E402

SOURCE_ID = "maclaren-expositions"
UA = "Mozilla/5.0 (sensus-ingest; local research pipeline)"
GUT_LICENSE_URL = "https://www.gutenberg.org/policy/license.html"
AUTHOR = "Alexander Maclaren (1826-1910)"

# (eBook do Project Gutenberg, rótulo do volume em inglês, como na capa)
VOLUMES: list[tuple[int, str]] = [
    (7069, "Genesis, Exodus, Leviticus and Numbers"),
    (7351, "St. Matthew, chaps. IX to XXVIII"),
    (7883, "Second Kings (from chap. VIII), Chronicles, Ezra, Nehemiah, Esther, Job, Proverbs and Ecclesiastes"),
    (7925, "Psalms"),
    (8068, "Deuteronomy, Joshua, Judges, Ruth, First Samuel, Second Samuel, First and Second Kings (chaps. I to VII)"),
    (8069, "Isaiah and Jeremiah"),
    (8070, "St. John, chaps. I to XIV"),
    (8071, "St. Mark"),
    (8200, "St. Luke, vol. I, chaps. I to XII"),
    (8381, "St. John, chaps. XV to XXI"),
    (8397, "The Acts"),
    (13601, "Romans; Corinthians (to 2 Corinthians, chap. V)"),
    (15836, "Ezekiel, Daniel and the Minor Prophets; St. Matthew, chaps. I to VIII"),
    (21190, "2 Corinthians, Galatians and Philippians; Colossians, Thessalonians and 1 Timothy"),
    (24674, "Ephesians; Epistles of St. Peter and St. John"),
]

QUOTES = "'\"‘“"
START = re.compile(r"^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG.*$", re.M)
END = re.compile(r"^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG.*$", re.M)
ITALICO = re.compile(r"_([^_\n]+?)_")
ORNAMENTO = re.compile(r"^[\s*]*$|^\[[^\]]*\]$")
# Parêntese final do título: "(Genesis xv. 5-18)", "(2 Chron. viii. 12-13, R.V.)".
PARENTESE_FINAL = re.compile(r"\s*\(([^()]*)\)\s*$")
# Cabeçalho da epígrafe: "--GENESIS v. 22." ou "—JOHN vii. 37,38." no fim do parágrafo (EPIGRAFE_FIM), ou
# "...' GENESIS XV. 6." logo depois da citação, em maiúsculas (EPIGRAFE_CAIXA). Capítulo é romano ou arábico
# seguido de delimitador (assim "--consent" não vira capítulo "c").
_REF = r"(?P<ref>(?:[ivxlcIVXLC]+|\d{1,3})(?![A-Za-z])(?:[\dIVXLCivxlc\s.,:;\-–—]|\band\b){0,30}?)"
_LIVRO = r"(?P<livro>(?:[1-3]\s+)?[A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)?)"
EPIGRAFE_FIM = re.compile(r"(?:-{1,2}|—)\s*" + _LIVRO + r"\s*,?\s*" + _REF + r"[\s.'\"‘’“”]*$")
EPIGRAFE_CAIXA = re.compile(
    r"['\"‘’“”.!?]\s*(?P<livro>[1-3]?\s?[A-Z][A-Z.]*(?:\s+[A-Z][A-Z.]*)?)\s+" + _REF + r"\.")
# Título seguido de "--LIVRO cap" dentro do próprio texto da epígrafe: não é título.
EPIGRAFE_NO_TITULO = re.compile(r"--\s*[A-Z][A-Z.]*\s+(?:[ivxlcIVXLC]+|\d)")
# "(R.V.)" e "(A.V.)" saem da epígrafe antes de procurar o cabeçalho.
VERSAO = re.compile(r",?\s*\(?\s*(?:[RA]\.\s?V\.?|Rev\.\s?Ver\.?)\s*\)?")


@dataclass
class Sermao:
    titulo: str                  # título como impresso, sem a passagem entre parênteses
    parentese: str | None        # conteúdo do parêntese final do título (a passagem, em geral)
    epigrafe: str | None         # citação da Escritura (não entra no comentário)
    cabecalho: str | None        # "LIVRO cap. v." da epígrafe
    paragrafos: list[str]        # corpo do sermão


# ---- texto ----------------------------------------------------------------

def corpo_do_gutenberg(texto: str) -> str:
    """Texto entre a linha de início e a de fim do Project Gutenberg (cabeçalho e licença saem)."""
    inicio = START.search(texto)
    fim = END.search(texto)
    ini = inicio.end() if inicio else 0
    return texto[ini:fim.start() if fim else len(texto)]


def paragrafos(corpo: str) -> list[str]:
    """Parágrafos do texto: blocos separados por linha em branco, com as linhas juntadas e sem itálico/ornamento."""
    out = []
    for bloco in re.split(r"\n\s*\n", corpo):
        p = " ".join(linha.strip() for linha in bloco.split("\n"))
        p = re.sub(r"\s{2,}", " ", ITALICO.sub(r"\1", p)).strip()
        if p and not ORNAMENTO.match(p):
            out.append(p)
    return out


def e_titulo(p: str) -> bool:
    """Título de sermão: maiúsculas (sem a passagem entre parênteses) e não é epígrafe nem frase longa."""
    base = PARENTESE_FINAL.sub("", p).strip()
    letras = [c for c in base if c.isalpha()]
    return (len(letras) >= 3 and not any(c.islower() for c in letras) and len(p) <= 260
            and not EPIGRAFE_NO_TITULO.search(base))


def _separa_epigrafe(ps: list[str]) -> tuple[str | None, str | None, list[str]]:
    """(epígrafe, cabeçalho da epígrafe, corpo). A epígrafe começa com aspas e vai até o parágrafo que traz o
    cabeçalho. Se o cabeçalho cai no meio de um parágrafo, o resto dele é corpo. Sem cabeçalho, a epígrafe é só
    o primeiro parágrafo."""
    if not ps or ps[0][:1] not in QUOTES:
        return None, None, ps
    for i, bruto in enumerate(ps[:6]):
        p = VERSAO.sub("", bruto)
        m = EPIGRAFE_FIM.search(p) or EPIGRAFE_CAIXA.search(p)
        if m:
            epigrafe = " ".join(ps[:i] + [p[:m.end()]])
            resto = p[m.end():].strip()
            return epigrafe, f"{m.group('livro')} {m.group('ref')}", ([resto] if resto else []) + ps[i + 1:]
    return ps[0], None, ps[1:]


def _sermao(titulo_bruto: str, ps: list[str]) -> Sermao:
    m = PARENTESE_FINAL.search(titulo_bruto)
    epigrafe, cabecalho, corpo = _separa_epigrafe(ps)
    return Sermao(
        titulo=(titulo_bruto[:m.start()] if m else titulo_bruto).strip(),
        parentese=m.group(1) if m else None,
        epigrafe=epigrafe,
        cabecalho=cabecalho,
        paragrafos=corpo,
    )


def separa_sermoes(paras: list[str]) -> list[Sermao]:
    """Sermões na ordem do livro. Título que vem logo depois de outro título (sem texto) substitui o anterior."""
    blocos: list[tuple[str, list[str]]] = []
    for p in paras:
        if e_titulo(p):
            if blocos and not blocos[-1][1]:
                blocos[-1] = (p, [])  # título de grupo: o próximo título é o do sermão
            else:
                blocos.append((p, []))
        elif blocos:
            blocos[-1][1].append(p)
    return [_sermao(t, ps) for t, ps in blocos]


# ---- passagem -------------------------------------------------------------

def _trecho(texto: str) -> str:
    """Primeira referência de um cabeçalho: sem "R.V."/"A.V.", sem "St." antes do livro, com " and " como vírgula,
    "ill" (OCR) como "iii" e "l" (OCR) como "1" antes de número."""
    t = re.sub(r",?\s*[RA]\.\s?V\.?", "", texto.replace("\xa0", " ")).split(";")[0].strip()
    t = re.sub(r"^St\.?\s+", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+and\s+", ", ", t)
    t = re.sub(r"\bill\b", "iii", t)
    return re.sub(r"\bl(?=\d)", "1", t)


def passagem(s: Sermao) -> tuple[tuple[int, int] | None, str | None]:
    """(intervalo, motivo de descarte). Ordem: parêntese do título e, depois, cabeçalho da epígrafe."""
    candidatos = [t for t in (s.parentese, s.cabecalho) if t is not None]
    for texto in candidatos:
        r = passagem_cabecalho(_trecho(texto))
        if r is not None:
            return r, None
    return None, ("cabecalho_ilegivel" if candidatos else "sem_cabecalho")


def texto_do_comentario(rotulo: str, s: Sermao) -> str:
    cabecalho = f"Maclaren — {rotulo}: {s.titulo}"
    return "\n\n".join([cabecalho] + s.paragrafos)


def linhas_do_volume(texto_bruto: str, rotulo: str) -> tuple[list[tuple[int, int, str]], Counter]:
    """(start_vid, end_vid, texto) de cada sermão mantido, e contagens: sermoes e descartados por motivo."""
    sermoes = separa_sermoes(paragrafos(corpo_do_gutenberg(texto_bruto)))
    stats: Counter = Counter({"sermoes": len(sermoes)})
    linhas = []
    for s in sermoes:
        intervalo, motivo = passagem(s)
        if intervalo is None:
            # Título sem passagem e com no máximo um parágrafo de corpo: cabeçalho de seção (ex.: "THE BOOK OF
            # JOSHUA"), não sermão. Sermão sem passagem com corpo maior fica em sem_cabecalho.
            if motivo == "sem_cabecalho" and len(s.paragrafos) <= 1:
                motivo = "secao"
            stats[motivo] += 1
            continue
        if not s.paragrafos:
            stats["sem_texto"] += 1
            continue
        linhas.append((intervalo[0], intervalo[1], texto_do_comentario(rotulo, s)))
    stats["mantidos"] = len(linhas)
    return linhas, stats


# ---- capítulos (The Expositor's Bible) ------------------------------------
# Cada capítulo do volume (uma aula ou seção, às vezes com número de capítulo bíblico no título) vira UMA linha. O
# cabeçalho é: uma linha com o número ("CHAPTER III." ou "III.", na coluna 0; o sumário vem indentado e não conta),
# o título em maiúsculas e a passagem, que é uma linha só ("JOSHUA i. 2.") ou a citação que fecha a epígrafe
# ("...--1 COR. i. 2-9."). Texto antes do primeiro capítulo (prefácio, introdução do editor) não entra.

_CAPITULO = re.compile(r"^\s*(?:(?:CHAPTER|PSALM)S?\s+)?[IVXLC]+\.?\s*$")
# Linha só com a passagem: "JOSHUA i. 2.", "JOSHUA ii.", "1 COR. ix. 1-22.". Título como "PART V." também casa, e
# falha depois na versificação (vira cabecalho_ilegivel).
_PASSAGEM_SOLTA = re.compile(
    r"^(?:[1-3]\s?)?[A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)?\s+[ivxlcIVXLC\d]+\.?[\d.,:;\s\-–—ivxlcIVXLC]*"
    r"(?:\s*\([^()]*\))?(?:\s*(?:--|—).*)?$")
_REF_FINAL = re.compile(r"([ivxlcIVXLC]+\.\s*\d{1,3}(?:\s*[-–,]\s*\d{1,3})*\.?)$")


def _passagem_solta(p: str) -> bool:
    """Linha que é só a passagem: "JOSHUA i. 2.", "ISAIAH i.--HIS GENERAL PREFACE.", "ISAIAH ii. (740 B.C.)."."""
    return len(p) <= 120 and bool(_PASSAGEM_SOLTA.match(p.strip()))


def _passagem_da_linha(p: str) -> str:
    """Só a referência de uma linha de passagem: sem o parêntese e sem o subtítulo depois de "--"."""
    ref = re.split(r"\s*(?:--|—)", re.sub(r"\s*\([^()]*\)", "", p.strip()))[0].strip()
    return re.sub(r"\.\.$", ".", ref)  # "ISAIAH ii. (740 B.C.)." sem o parêntese fica "ISAIAH ii.."


def _e_titulo_capitulo(p: str) -> bool:
    """Título de capítulo: até 120 caracteres, sem aspas de epígrafe nem ser passagem, e com a maioria das palavras
    em maiúscula inicial ("THE SPIES IN JERICHO", "The Beginning Of The Gospel")."""
    palavras = re.findall(r"[A-Za-z][A-Za-z'’]*", p)
    return (0 < len(p) <= 120 and bool(palavras) and p[:1] not in QUOTES and not _passagem_solta(p)
            and sum(w[0].isupper() for w in palavras) >= 0.7 * len(palavras))


def _e_citacao(p: str) -> bool:
    """Epígrafe que fecha com a citação ("...--1 COR. i. 2-9."), ou seja, começa com aspas e tem cabeçalho."""
    if p[:1] not in QUOTES:
        return False
    q = VERSAO.sub("", p)
    return bool(EPIGRAFE_FIM.search(q) or EPIGRAFE_CAIXA.search(q))


def _tem_cabecalho(ps: list[str]) -> bool:
    """A seção abre com a passagem (linha solta ou epígrafe) logo no começo, depois de um título opcional."""
    return any(_passagem_solta(p) or _e_citacao(p) for p in ps[:2])


def _capitulo(ps: list[str]) -> Sermao:
    """Um capítulo: título (se houver), depois a passagem (linha solta ou epígrafe) e o corpo."""
    titulo, resto = "", ps
    if resto and _e_titulo_capitulo(resto[0]):
        titulo, resto = resto[0].rstrip(". "), resto[1:]
    if resto and _passagem_solta(resto[0]):
        return Sermao(titulo=titulo, parentese=None, epigrafe=None, cabecalho=_passagem_da_linha(resto[0]),
                      paragrafos=resto[1:])
    epigrafe, cabecalho, corpo = _separa_epigrafe(resto)
    if cabecalho and corpo and _e_titulo_capitulo(corpo[0]):
        # O título vem logo depois da epígrafe (1 Coríntios): é o título do capítulo, não texto. Se já havia título
        # antes da epígrafe, é o mesmo título repetido.
        titulo = titulo or corpo[0].rstrip(". ")
        corpo = corpo[1:]
    return Sermao(titulo=titulo, parentese=None, epigrafe=epigrafe, cabecalho=cabecalho, paragrafos=corpo)


def _segmentos_capitulos(corpo: str) -> list[list[str]]:
    """Parágrafos de cada seção: [antes do 1º cabeçalho, depois do 1º, depois do 2º...]. Um cabeçalho é uma linha
    só com o número ("CHAPTER III.", "III.", "PSALM  I."), com qualquer recuo. A epígrafe pode vir ANTES do número
    (1 Coríntios: título, epígrafe, "II.", título, corpo): quando a seção não abre com passagem, sobe dela a epígrafe
    (e o título logo antes) da seção anterior."""
    linhas = corpo.split("\n")
    bordas = [i for i, ln in enumerate(linhas) if _CAPITULO.match(ln)]
    segs = [paragrafos("\n".join(linhas[:bordas[0]] if bordas else linhas))]
    for k, b in enumerate(bordas):
        fim = bordas[k + 1] if k + 1 < len(bordas) else len(linhas)
        ps = paragrafos("\n".join(linhas[b + 1:fim]))
        if linhas[b].strip().upper().startswith("PSALM"):  # salmos: o número do salmo é a passagem (o salmo inteiro)
            # O texto do salmo, em versos numerados ("1 Happy the man... 2 ..."), sai: é a Escritura que o app já mostra.
            while ps and re.match(r"^\d{1,3} [A-Za-z]", ps[0]):  # blocos que começam com número de verso
                ps = ps[1:]
            ps = [f"PSALM {linhas[b].split()[-1].rstrip('.')}."] + ps
        segs.append(ps)
    # Ordem decrescente: a epígrafe sobe um passo de cada vez, até a seção que a usa.
    for j in range(len(segs) - 1, 0, -1):
        if _tem_cabecalho(segs[j]) or not segs[j - 1] or not _e_citacao(segs[j - 1][-1]):
            continue
        n = 2 if len(segs[j - 1]) >= 2 and _e_titulo_capitulo(segs[j - 1][-2]) else 1
        segs[j] = segs[j - 1][-n:] + segs[j]
        segs[j - 1] = segs[j - 1][:-n]
    return segs


def texto_do_capitulo(livro: str, autor: str, c: Sermao) -> str:
    cabecalho = f"The Expositor's Bible — {livro} ({autor})" + (f": {c.titulo}" if c.titulo else "")
    return "\n\n".join([cabecalho] + c.paragrafos)


def linhas_de_capitulos(texto_bruto: str, livro: str, autor: str) -> tuple[list[tuple[int, int, str]], Counter]:
    """(start_vid, end_vid, texto) de cada capítulo mantido, e contagens: capitulos e descartados por motivo."""
    segs = _segmentos_capitulos(corpo_do_gutenberg(texto_bruto))
    stats: Counter = Counter({"capitulos": len(segs) - 1})
    linhas = []
    for ps in segs[1:]:  # segs[0] é o que vem antes do primeiro cabeçalho (capa, sumário, prefácio)
        c = _capitulo(ps)
        intervalo, motivo = passagem(c)
        if intervalo is None:
            if motivo == "sem_cabecalho" and len(c.paragrafos) <= 1:
                motivo = "secao"  # cabeçalho de seção sem passagem e sem texto (ex.: "THE BOOK OF JOSHUA")
            stats[motivo] += 1
            continue
        if not c.paragrafos:
            stats["sem_texto"] += 1
            continue
        linhas.append((intervalo[0], intervalo[1], texto_do_capitulo(livro, autor, c)))
    stats["mantidos"] = len(linhas)
    return linhas, stats


# ---- obras -------------------------------------------------------------------

# Regra do Brasil: domínio público para autor falecido há mais de 70 anos. Em 2026, morte até 1955.
LIMITE_MORTE = 1955


@dataclass(frozen=True)
class Volume:
    ebook: int       # eBook do Project Gutenberg
    rotulo: str      # livro (ou volume) em inglês, como sai no título
    autor: str       # autor do volume (The Expositor's Bible tem um autor por volume)
    morte: int       # ano da morte do autor


@dataclass(frozen=True)
class Obra:
    source_id: str
    titulo: str                  # source.title
    autor: str                   # source.author
    url: str                     # source.url
    volumes: tuple[Volume, ...]
    linhas: Callable[[str, Volume], tuple[list, Counter]]  # (texto bruto, volume) -> linhas, contagens
    tradicao: str
    atribuicao: str              # "{ebooks}" vira a lista de eBooks mantidos
    notas: str


MACLAREN = Obra(
    source_id=SOURCE_ID,
    titulo="Expositions of Holy Scripture",
    autor=AUTHOR,
    url="https://www.gutenberg.org/ebooks/7069",
    volumes=tuple(Volume(n, rotulo, AUTHOR, 1910) for n, rotulo in VOLUMES),
    linhas=lambda texto, v: linhas_do_volume(texto, v.rotulo),
    tradicao="baptist",
    atribuicao=(
        "Expositions of Holy Scripture, Alexander Maclaren. Project Gutenberg eBooks {ebooks}, sem o cabeçalho e o "
        "rodapé da licença do Project Gutenberg. Domínio público: autor falecido em 1910 e obras publicadas de 1904 a "
        "1910 (domínio público nos EUA); no Brasil, autor falecido há mais de 70 anos."
    ),
    notas=(
        "Sermão por texto: um comentário por sermão, no intervalo da passagem do cabeçalho (parêntese do "
        "título ou fim da epígrafe). O texto começa com 'Maclaren — <volume>: <sermão>' e traz o corpo "
        "inteiro; a epígrafe não entra. Descartados: sem cabeçalho, cabeçalho ilegível e sem texto. Texto em "
        "inglês."
    ),
)

# The Expositor's Bible (W. Robertson Nicoll, ed.; 1887-1905). Autor e ano da morte de cada volume: catálogo do
# Project Gutenberg (sobrenome, nome, datas). O volume "Expositor's Bible: Index" (eBook #39819) não é comentário.
EXPOSITORS = Obra(
    source_id="expositors-bible",
    titulo="The Expositor's Bible",
    autor="Vários autores (ed. W. Robertson Nicoll)",
    url="https://www.gutenberg.org/ebooks/32968",
    volumes=(
        Volume(32968, "Hebrews", "Thomas Charles Edwards", 1900),
        Volume(33151, "John, vol. 1", "Marcus Dods", 1909),
        Volume(33288, "John, vol. 2", "Marcus Dods", 1909),
        Volume(33420, "Exodus", "George Alexander Chadwick", 1923),
        Volume(37120, "Mark", "George Alexander Chadwick", 1923),
        Volume(37345, "Colossians and Philemon", "Alexander Maclaren", 1910),
        Volume(39196, "Ephesians", "George G. Findlay", 1919),
        Volume(39394, "1 Samuel", "William Garden Blaikie", 1899),
        Volume(39395, "Genesis", "Marcus Dods", 1909),
        Volume(39628, "Pastoral Epistles", "Alfred Plummer", 1926),
        Volume(39727, "Judges and Ruth", "Robert A. Watson", 1921),
        Volume(39767, "Isaiah, vol. 1", "George Adam Smith", 1942),
        Volume(39788, "Philippians", "Robert Rainy", 1906),
        Volume(39856, "Luke", "Henry Burton", 1930),
        Volume(39913, "Ecclesiastes", "Samuel Cox", 1893),
        Volume(39941, "Song of Solomon and Lamentations", "Walter F. Adeney", 1920),
        Volume(39956, "Ezra, Nehemiah and Esther", "Walter F. Adeney", 1920),
        Volume(40235, "Chronicles", "William Henry Bennett", 1920),
        Volume(40470, "Job", "Robert A. Watson", 1921),
        Volume(40775, "Epistles of John", "William Alexander", 1911),
        Volume(40811, "Matthew", "John Monro Gibson", 1921),
        Volume(41850, "2 Corinthians", "James Denney", 1917),
        Volume(41893, "Jeremiah, chaps. XXI-LII", "William Henry Bennett", 1920),
        Volume(42027, "2 Kings", "Frederic William Farrar", 1903),
        Volume(42189, "Proverbs", "Robert F. Horton", 1934),
        Volume(42251, "Revelation", "William Milligan", 1893),
        Volume(42258, "Acts, vol. 1", "George Thomas Stokes", 1898),
        Volume(42273, "Epistles of St. Peter", "J. Rawson Lumby", 1895),
        Volume(42303, "Acts, vol. 2", "George Thomas Stokes", 1898),
        Volume(42319, "Joshua", "William Garden Blaikie", 1899),
        Volume(42334, "Leviticus", "Samuel H. Kellogg", 1899),
        Volume(42354, "1 Corinthians", "Marcus Dods", 1909),
        Volume(42445, "Psalms, vol. 1", "Alexander Maclaren", 1910),
        Volume(42488, "Psalms, vol. 2", "Alexander Maclaren", 1910),
        Volume(42601, "Jeremiah", "Charles James Ball", 1924),
        Volume(42639, "Numbers", "Robert A. Watson", 1921),
        Volume(42645, "Galatians", "George G. Findlay", 1919),
        Volume(42753, "Thessalonians", "James Denney", 1917),
        Volume(42891, "1 Kings", "Frederic William Farrar", 1903),
        Volume(43672, "Isaiah, vol. 2", "George Adam Smith", 1942),
        Volume(43847, "The Twelve Prophets, vol. 1", "George Adam Smith", 1942),
        Volume(44027, "Psalms, vol. 3", "Alexander Maclaren", 1910),
        Volume(44103, "Daniel", "Frederic William Farrar", 1903),
        Volume(44619, "2 Samuel", "William Garden Blaikie", 1899),
        Volume(46975, "Ezekiel", "John Skinner", 1925),
        Volume(47337, "James and Jude", "Alfred Plummer", 1926),
        Volume(48858, "Romans", "Handley Carr Glyn Moule", 1920),
        Volume(49045, "Deuteronomy", "Andrew Harper", 1936),
        Volume(50747, "The Twelve Prophets, vol. 2", "George Adam Smith", 1942),
    ),
    linhas=lambda texto, v: linhas_de_capitulos(texto, v.rotulo, v.autor),
    tradicao="presbyterian",
    atribuicao=(
        "The Expositor's Bible, ed. W. Robertson Nicoll (1887-1905). Project Gutenberg eBooks {ebooks}, sem o "
        "cabeçalho e o rodapé da licença do Project Gutenberg. Domínio público: autores falecidos entre 1893 e 1942 "
        "(domínio público nos EUA); no Brasil, autor falecido há mais de 70 anos."
    ),
    notas=(
        "Capítulo por texto: uma linha por capítulo do volume, no intervalo da passagem do cabeçalho (linha depois do "
        "título ou citação que fecha a epígrafe). O texto começa com \"The Expositor's Bible — <livro> (<autor>): "
        "<título>\" e traz o corpo inteiro; a epígrafe não entra. Descartados: sem passagem, passagem ilegível e sem "
        "texto. Autores variam por volume (maioria presbiteriana escocesa; Maclaren, batista; Farrar, Moule e Plummer, "
        "anglicanos); a tradição do registro é a presbiteriana. Texto em inglês."
    ),
)

OBRAS: dict[str, Obra] = {"maclaren": MACLAREN, "expositors": EXPOSITORS}


# ---- download e gravação --------------------------------------------------

def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def baixa(n: int, dest: Path) -> Path:
    """Baixa o eBook n (texto simples UTF-8) se ainda não estiver em data/raw. Uma requisição por vez."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(f"https://www.gutenberg.org/cache/epub/{n}/pg{n}.txt", headers={"User-Agent": UA})
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 16):
            f.write(chunk)
    tmp.rename(dest)
    time.sleep(3)  # respeita o Gutenberg: pausa entre downloads
    return dest


def main(obra: Obra) -> None:
    rows: list[tuple[int, int, str]] = []
    hashes = []
    total: Counter = Counter()
    mantidos: list[Volume] = []
    for v in obra.volumes:
        if v.morte > LIMITE_MORTE:
            total["autor_recente"] += 1
            print(f"[{obra.source_id}] pg{v.ebook} {v.rotulo}: descartado (autor falecido em {v.morte})")
            continue
        path = baixa(v.ebook, RAW / obra.source_id / f"pg{v.ebook}.txt")
        texto = path.read_text(encoding="utf-8-sig")
        linhas, stats = obra.linhas(texto, v)
        rows.extend(linhas)
        total.update(stats)
        mantidos.append(v)
        hashes.append(f"pg{v.ebook} {sha256_of(path)[:12]}")
        print(f"[{obra.source_id}] pg{v.ebook} {v.rotulo}: {dict(stats)}")
    print(f"[{obra.source_id}] total: {dict(total)}")

    ebooks = ", ".join(f"#{v.ebook}" for v in mantidos)
    with StagingWriter(obra.source_id) as w:
        w.source(
            kind="commentary",
            title=obra.titulo,
            author=obra.autor,
            lang="en",
            license="Public Domain",
            license_url=GUT_LICENSE_URL,
            url=obra.url,
            version="Project Gutenberg, eBooks " + ebooks + "; arquivos " + "; ".join(hashes),
            attribution=obra.atribuicao.format(ebooks=ebooks),
            tradition=obra.tradicao,
            notes=obra.notas,
        )
        seen: Counter = Counter()
        for start, end, text in sorted(rows, key=lambda r: (r[0], r[1])):
            base = cite_com(obra.source_id, start, end)
            seen[base] += 1
            cite = base if seen[base] == 1 else f"{base}.{seen[base]}"
            w.row("commentary", cite_id=cite, start_vid=start, end_vid=end, text=text)


if __name__ == "__main__":
    nome = sys.argv[1] if len(sys.argv) > 1 else "maclaren"
    main(OBRAS[nome])
