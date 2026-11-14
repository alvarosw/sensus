"""Ingere os sermões expositivos de Alexander Maclaren (Expositions of Holy Scripture) como comentário por texto.

Cada sermão vira UMA linha de comentário, no intervalo da passagem do seu cabeçalho. O texto começa com
"Maclaren — <título do volume>: <título do sermão>" e segue com o corpo do sermão inteiro (sem truncar). A epígrafe
(a citação da Escritura, com "--LIVRO cap. v.") não entra: é o texto bíblico que o app já mostra.

Fonte: Project Gutenberg, 15 volumes (eBooks #7069 a #24674; ver VOLUMES). Alexander Maclaren (1826-1910) e as
obras (1904-1910) estão em domínio público (ver DATA_LICENSES.md).

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

Uso:
    cd pipeline && python3 -I ingest/sermoes_gutenberg.py
"""

import hashlib
import re
import sys
import time
import urllib.request
from collections import Counter
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
VERSAO = re.compile(r",?\s*\(?\s*[RA]\.\s?V\.?\s*\)?")


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
    """Primeira referência de um cabeçalho: sem "R.V."/"A.V.", com " and " como vírgula, "ill" (OCR) como "iii" e
    "l" (OCR) como "1" antes de número."""
    t = re.sub(r",?\s*[RA]\.\s?V\.?", "", texto).split(";")[0].strip()
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


def main() -> None:
    rows: list[tuple[int, int, str]] = []
    hashes = []
    total: Counter = Counter()
    for n, rotulo in VOLUMES:
        path = baixa(n, RAW / SOURCE_ID / f"pg{n}.txt")
        texto = path.read_text(encoding="utf-8-sig")
        linhas, stats = linhas_do_volume(texto, rotulo)
        rows.extend(linhas)
        total.update(stats)
        hashes.append(f"pg{n} {sha256_of(path)[:12]}")
        print(f"[{SOURCE_ID}] pg{n} {rotulo}: {dict(stats)}")
    print(f"[{SOURCE_ID}] total: {dict(total)}")

    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="commentary",
            title="Expositions of Holy Scripture",
            author=AUTHOR,
            lang="en",
            license="Public Domain",
            license_url=GUT_LICENSE_URL,
            url="https://www.gutenberg.org/ebooks/7069",
            version="Project Gutenberg, eBooks " + ", ".join(f"#{n}" for n, _ in VOLUMES)
                    + "; arquivos " + "; ".join(hashes),
            attribution=(
                "Expositions of Holy Scripture, Alexander Maclaren. Project Gutenberg eBooks "
                + ", ".join(f"#{n}" for n, _ in VOLUMES)
                + ", sem o cabeçalho e o rodapé da licença do Project Gutenberg. Domínio público: autor falecido em "
                "1910 e obras publicadas de 1904 a 1910 (domínio público nos EUA); no Brasil, autor falecido há mais "
                "de 70 anos."
            ),
            tradition="baptist",
            notes=(
                "Sermão por texto: um comentário por sermão, no intervalo da passagem do cabeçalho (parêntese do "
                "título ou fim da epígrafe). O texto começa com 'Maclaren — <volume>: <sermão>' e traz o corpo "
                "inteiro; a epígrafe não entra. Descartados: sem cabeçalho, cabeçalho ilegível e sem texto. Texto em "
                "inglês."
            ),
        )
        seen: Counter = Counter()
        for start, end, text in sorted(rows, key=lambda r: (r[0], r[1])):
            base = cite_com(SOURCE_ID, start, end)
            seen[base] += 1
            cite = base if seen[base] == 1 else f"{base}.{seen[base]}"
            w.row("commentary", cite_id=cite, start_vid=start, end_vid=end, text=text)


if __name__ == "__main__":
    main()
