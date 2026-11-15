"""Ingere comentários versículo a versículo de digitalizações do archive.org (texto OCR, djvu.txt).

Cada comentário de versículo (ou de intervalo "Vers. 1-3") vira uma linha de comentário no intervalo. O texto começa
com "<Autor> — <Obra>: " e segue com o corpo do comentário (todos os parágrafos do versículo, sem notas de página).

Obras (CONFIGS), todas NOT_IN_COPYRIGHT no archive.org, conferidas na página do item (data e autor):
- broadus-matthew: John A. Broadus, Commentary on the Gospel of Matthew (c1886; autor 1827-1895; batista).
  Marcador "N.  " (dois espaços) no início do parágrafo, dentro de cada capítulo. Capítulo: "CHAPTER N." ou "Ch. N:".
- hodge-romans: Charles Hodge, Commentary on the Epistle to the Romans (1882; autor 1797-1878; presbiteriano).
  Marcador "VERSE N." (ou "VERSES N-M.") em caixa alta antes de cada comentário. Capítulo: "CHAPTER N.".
- haldane-romans: Robert Haldane, Exposition of the Epistle to the Romans (1874; autor 1764-1842; batista escocês
  reformado). Marcador "Ver. N.—" (o OCR lê "1" como "i"); o primeiro parágrafo do bloco é o próprio versículo,
  e sai. Capítulo: "CHAPTER N.— PART I" etc.

Regras (funções puras, testadas em pipeline/tests/test_comentario_escaneado.py):
- Cabeçalhos e rodapés de página (título corrente, "CH. I.] MATTHEW.", número de página) saem. Linhas que começam com
  número e espaço e sem ponto (nota de rodapé, versículo da Escritura impresso no meio do texto) saem.
- Hifenização de fim de linha: "Ju-" + "das" vira "Judas" (o OCR perde o hífen em alguns casos: não se corrige).
- Versículo: um marcador só vale se for coerente com a sequência do capítulo (sem voltar, sem pular demais, dentro do
  número de versículos da versificação KJV, ref. pipeline/ingest/refparse.py). Marcador com espaçamento irregular do
  OCR só vale se for o próximo versículo esperado. Sem isso, a numeração de listas dentro do comentário ("3.  Everywhere")
  vira versículo errado.
- Texto antes do primeiro marcador de cada seção (introdução, análise, bloco da Escritura) não entra.
- Descartes por motivo (contados): lixo_ocr (palavra que o OCR não recupera, pela auditoria de adventist_ocr_audit),
  curto (corpo com menos de 40 caracteres), sem_versiculo (versículo fora da versificação do capítulo).

Uso (uma obra por vez; padrão: todas):
    cd pipeline && .venv/bin/python -I ingest/comentario_escaneado.py broadus-matthew
"""

import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import RAW, StagingWriter, cite_com  # noqa: E402
from sensus.adventist_texto import ROMAN_OCR  # noqa: E402
from ingest.refparse import VERSES, roman_to_int  # noqa: E402
from ingest.adventist_ocr_audit import junk, load_dict, morph_ok, norm, tok_parts  # noqa: E402
from sensus.refs import vid  # noqa: E402

DOMINIO = ("Domínio público: obra publicada antes de 1929 e autor falecido há mais de 70 anos; "
           "NOT_IN_COPYRIGHT no archive.org, conferida na página do item.")

# Cabeçalho ou rodapé de página, que sai inteiro.
PAGINA = re.compile(
    r"^\s*CH\.?\s*[IVXLl1]*\.?\s*\]\s*$|^\s*CH\.[^\]]{0,12}\]\s*[A-Z]*\.?\s*$|^\s*\[C[Nn]\.\s*[IVXLl1]*\.?\s*$"
    r"|^\s*MATTHEW\.?\s*$|^\s*ROMANS\b.*$|^\s*\d{0,3}\s*ROMANS\s+[IVXL.\d\s]*\.?\s*\d*\s*$"
    r"|^\s*\d{1,4}\s*$|^\s*\d{0,3}\s*(?:\w{1,3}\s*)?\(?\d{1,3}\)?\s*$"
)
# Linha que começa com número, espaço e maiúscula, sem ponto: nota de rodapé ou versículo da Escritura no texto.
NOTA_OU_VERSO = re.compile(r"^\s*\d{1,3}\s{1,3}[A-Z\"“‘(]")
# Hífen de fim de linha (o OCR mantém o traço).
HIFEN_FIM = re.compile(r"(?<=[a-z])-$")
ROMAN_RE = re.compile(r"^[IVXLCDivxlcd]+$")


@dataclass(frozen=True)
class Config:
    source_id: str
    autor: str
    obra: str
    tradicao: str
    url: str
    arquivo: str            # nome do djvu.txt em data/raw/<source_id>/
    livro: int              # número do livro na versificação KJV
    capitulos_max: int      # último capítulo do livro
    cap: re.Pattern         # cabeçalho de capítulo; grupo "c" = número ou romano
    marca: re.Pattern       # início de comentário de versículo; grupos "a", "b" (fim, opcional), "esp" (espaços)
    fim: re.Pattern | None  # a partir daqui o texto é índice/apêndice e não entra
    sai_primeiro: bool = False  # o primeiro parágrafo do bloco do versículo é a própria Escritura (Haldane)
    pagina: re.Pattern = PAGINA
    atribuicao: str = ""
    notas: str = ""


CONFIGS: dict[str, Config] = {
    "broadus-matthew": Config(
        source_id="broadus-matthew",
        autor="John A. Broadus (1827-1895)",
        obra="Commentary on the Gospel of Matthew",
        tradicao="baptist",
        url="https://archive.org/details/commentonmatthew00broauoft",
        arquivo="commentonmatthew00broauoft_djvu.txt",
        livro=40,
        capitulos_max=28,
        cap=re.compile(r"^\s*(?:[IVX]+\.\s+)?(?:CHAPTER\s+(?P<c>[IVXL]+|IIL|XVILE)\.?\s*$|Ch\.?\s*(?P<c2>\d{1,2})\s*[.:]+\s*\d)"),
        marca=re.compile(r"^(?P<esp>\s{0,3})(?P<a>\d{1,3})\.(?P<sp> {2,5})(?=[\"“‘'(\[]?[A-Z(\"“‘\[])(?P<resto>.*)$"),
        fim=re.compile(r"^\s*INDEX\s+[IVX]+\.?\s*$"),
        atribuicao=("John A. Broadus, Commentary on the Gospel of Matthew (An American Commentary on the New Testament, "
                    "American Baptist Publication Society, c1886), archive.org commentonmatthew00broauoft. " + DOMINIO),
        notas=("Comentário de Mateus por versículo: o marcador 'N.' no início do parágrafo, dentro de cada capítulo. "
               "Introdução, notas de texto e índice não entram."),
    ),
    "hodge-romans": Config(
        source_id="hodge-romans",
        autor="Charles Hodge (1797-1878)",
        obra="Commentary on the Epistle to the Romans",
        tradicao="presbyterian",
        url="https://archive.org/details/commentaryonthee00hodguoft",
        arquivo="commentaryonthee00hodguoft_djvu.txt",
        livro=45,
        capitulos_max=16,
        cap=re.compile(r"^\s*CHAPTE[RE]{1,2}\s+(?P<c>[IVXL]+)\.?\s*$"),
        marca=re.compile(r"^(?P<esp>\s{0,3})VERSES?\s+(?P<a>\d{1,3})(?:\s*[-–—]\s*(?P<b>\d{1,3}))?\.(?P<resto>.*)$"),
        fim=None,
        atribuicao=("Charles Hodge, Commentary on the Epistle to the Romans (New York: R. Carter, 1882), archive.org "
                    "commentaryonthee00hodguoft. " + DOMINIO),
        notas=("Comentário de Romanos por versículo: o marcador 'VERSE N.' (ou 'VERSES N-M.') em caixa alta. A análise "
               "de cada capítulo (contexto e analysis) não entra."),
    ),
    "haldane-romans": Config(
        source_id="haldane-romans",
        autor="Robert Haldane (1764-1842)",
        obra="Exposition of the Epistle to the Romans",
        tradicao="reformed-baptist",
        url="https://archive.org/details/expositionofthee00halduoft",
        arquivo="expositionofthee00halduoft_djvu.txt",
        livro=45,
        capitulos_max=16,
        cap=re.compile(r"^\s*CHAPTE[RE]{1,2}\s+(?P<c>[IVXL][IVXL\s]*?)\s*\.?\s*(?:[—–-]|\s*$|\s+PART)"),
        marca=re.compile(r"^(?P<esp>\s{0,3})Ver\.\s*(?P<a>[0-9ivxlIVXL]{1,4})\b\s*\.?\s*[—–-]{0,2}\s*(?P<resto>.*)$"),
        fim=None,
        sai_primeiro=True,
        atribuicao=("Robert Haldane, Exposition of the Epistle to the Romans (London: W. Oliphant, 1874), archive.org "
                    "expositionofthee00halduoft. " + DOMINIO),
        notas=("Comentário de Romanos por versículo: o marcador 'Ver. N.' (o OCR lê o 1 como 'i'). O primeiro parágrafo de "
               "cada bloco é o próprio versículo, que sai. Os comentários seguem, sem a análise do capítulo."),
    ),
}


# ---- texto -----------------------------------------------------------------

def limpa_linhas(texto: str, pagina: re.Pattern = PAGINA) -> list[str]:
    """Linhas do djvu.txt sem cabeçalho/rodapé de página, nota de rodapé nem versículo impresso no texto."""
    out = []
    for linha in texto.replace("\r", "").split("\n"):
        s = linha.rstrip()
        if not s.strip():
            out.append("")
            continue
        if pagina.match(s) or NOTA_OU_VERSO.match(s):
            continue
        s = re.sub(r"\s+\|\s*$", "", s.strip())  # "|" na margem do fim da linha (OCR), não é palavra
        out.append(s)  # espaçamento cru: o marcador "N.  " depende dos dois espaços
    return out


def junta_paragrafos(linhas: list[str]) -> list[str]:
    """Parágrafos (blocos separados por linha em branco), com as linhas juntadas e a hifenização desfeita."""
    paragrafos: list[str] = []
    atual = ""
    for linha in linhas:
        if not linha:
            if atual:
                paragrafos.append(atual)
                atual = ""
            continue
        linha = " ".join(linha.split())
        if not atual:
            atual = linha
        elif HIFEN_FIM.search(atual) and linha[:1].islower():
            atual = atual[:-1] + linha  # "Ju-" + "das": o traço era quebra de linha
        else:
            atual = atual + " " + linha
    if atual:
        paragrafos.append(atual)
    return paragrafos


def numero_romano_ou_arabico(tok: str) -> int | None:
    t = tok.strip().replace(" ", "")
    if t.isdigit():
        return int(t)
    t = ROMAN_OCR.get(t, t)
    if not ROMAN_RE.match(t):
        return None
    return roman_to_int(t)


# ---- sequência de versículos -------------------------------------------------

def _versiculo_valido(cfg: Config, c: int, v: int) -> bool:
    chs = VERSES[cfg.livro]
    return 1 <= c <= len(chs) and 1 <= v <= chs[c - 1]


def segmenta(linhas: list[str], cfg: Config) -> list[tuple[str, object]]:
    """Eventos do texto: ('cap', n), ('marca', (a, b, forte, resto)), ('texto', linha), ('fim', None)."""
    eventos: list[tuple[str, object]] = []
    for linha in linhas:
        if cfg.fim and cfg.fim.match(linha):
            eventos.append(("fim", None))
            break
        m = cfg.cap.match(linha) if linha.strip() else None
        if m:
            tok = m.group("c") or m.group("c2")
            n = numero_romano_ou_arabico(tok) if tok else None
            if n is not None:
                eventos.append(("cap", n))
                continue
        m = cfg.marca.match(linha) if linha.strip() else None
        if m:
            a = numero_romano_ou_arabico(m.group("a"))
            b = m.group("b") if "b" in m.re.groupindex else None
            forte = len(m.group("sp")) == 2 if "sp" in m.re.groupindex else True
            if a is not None:
                eventos.append(("marca", (a, numero_romano_ou_arabico(b) if b else None, forte,
                                          m.group("resto").strip())))
                continue
        eventos.append(("texto", linha))
    return eventos


def _sequencia_crescente(valores: list[int]) -> set[int]:
    """Índices de maior subsequência estritamente crescente (os versículos em ordem, sem voltar)."""
    if not valores:
        return set()
    tam = [1] * len(valores)
    ant = [-1] * len(valores)
    for i, v in enumerate(valores):
        for j in range(i):
            if valores[j] < v and tam[j] + 1 > tam[i]:
                tam[i], ant[i] = tam[j] + 1, j
    i = max(range(len(valores)), key=lambda k: (tam[k], -k))
    out = set()
    while i != -1:
        out.add(i)
        i = ant[i]
    return out


def comentarios(linhas: list[str], cfg: Config) -> tuple[list[tuple[int, int, int, list[str]]], Counter]:
    """(capítulo, versículo inicial, versículo final, parágrafos) de cada comentário.

    Marcador forte ("N." com dois espaços, "VERSE N.", "Ver. N."): dentro de cada capítulo, aceita-se a maior sequência
    crescente de números (ver _sequencia_crescente), o que deixa de fora as notas numeradas do próprio comentário ("3."
    em meio a um comentário de v. 1). Marcador de espaçamento irregular do OCR nunca abre comentário (vira texto).
    Marcador 1 perto do fim do capítulo abre o capítulo seguinte, sem cabeçalho. Marcador recusado vira texto.
    """
    stats: Counter = Counter()
    evs = segmenta(linhas, cfg)
    # 1. capítulo de cada marcador (cabeçalho, ou "1." no fim do capítulo anterior)
    cap = 0
    ult = 0
    marcas: dict[int, tuple[int, int, int]] = {}  # índice do evento -> (capítulo, início, fim)
    for i, (kind, val) in enumerate(evs):
        if kind == "fim":
            break
        if kind == "cap":
            n = int(val)
            if cap < n <= cfg.capitulos_max:
                cap, ult = n, 0
            continue
        if kind != "marca":
            continue
        a, b, forte, _ = val
        if cap == 0:
            stats["marca_antes_do_capitulo"] += 1
            continue
        if a == 1 and forte and ult >= VERSES[cfg.livro][cap - 1] - 3 and cap < cfg.capitulos_max:
            cap, ult = cap + 1, 0
            stats["capitulos_sem_cabecalho"] += 1
        if not forte:
            continue
        fim = b if b is not None else a
        if _versiculo_valido(cfg, cap, a) and (b is None or (a <= fim and _versiculo_valido(cfg, cap, fim))):
            marcas[i] = (cap, a, fim)
            ult = fim
    # 2. por capítulo, a maior sequência crescente de inícios
    por_cap: dict[int, list[int]] = {}
    for i, (c, a, _) in marcas.items():
        por_cap.setdefault(c, []).append(i)
    aceitas: set[int] = set()
    for c, idxs in por_cap.items():
        ordem = sorted(idxs)
        escolhidos = _sequencia_crescente([marcas[i][1] for i in ordem])
        aceitas.update(ordem[k] for k in escolhidos)
    stats["marca_recusada"] += len(marcas) - len(aceitas)
    # 3. texto de cada comentário: do marcador aceito até o próximo marcador aceito ou cabeçalho de capítulo
    out: list[tuple[int, int, int, list[str]]] = []
    atual: list | None = None
    for i, (kind, val) in enumerate(evs):
        if kind == "fim":
            break
        if kind == "cap":
            if atual is not None:
                out.append((atual[0], atual[1], atual[2], atual[3]))
                atual = None
            continue
        if kind == "texto":
            if atual is not None:
                atual[3].append(val)
            continue
        if i in aceitas:
            if atual is not None:
                out.append((atual[0], atual[1], atual[2], atual[3]))
            c, a, f = marcas[i]
            atual = [c, a, f, [val[3]] if val[3] else []]
            if val[1] is not None:
                stats["intervalos"] += 1
            continue
        if atual is not None:  # marcador recusado ou de espaçamento irregular: fica como texto
            a, _, _, resto = val
            atual[3].append(f"{a}. {resto}".strip())
    if atual is not None:
        out.append((atual[0], atual[1], atual[2], atual[3]))
    return out, stats


# ---- qualidade do texto (auditoria de OCR de adventist_ocr_audit) -----------

def _conhecida(words: set[str], ours: Counter):
    def known(n: str) -> bool:
        if len(n) == 1:
            return n in "ai"
        return n in words or (n.endswith("s") and n[:-1] in words) or n.isdigit() or morph_ok(n, words) or ours[n] >= 3
    return known


# Abreviações de uso comum em comentário (sem vogal, mas não são lixo).
ABREVIACOES = {"ff", "f", "mss", "cn", "vv", "tr", "ch", "cf", "vs", "sq"}


# Número de nota de rodapé colado à palavra ("birth1", "Nazareth1") ou à frente dela ("1This"): sai, não é lixo.
NOTA_COLADA = re.compile(
    r"(?<=[A-Za-z.,;:)”’\"'])\^?\d{1,2}(?=[\s.,;:)”’\"']|$)|^\d{1,2}(?=[A-Z][a-z])|\^\d{1,2}")


def tira_nota_colada(tok: str) -> str:
    return NOTA_COLADA.sub("", tok)


def corrige_digito_o(tok: str) -> str:
    """"2O." -> "20.", "1G:" -> "10:": a letra O (ou G) lida no lugar de zero, dentro de número."""
    if re.search(r"[OG]", tok) and re.fullmatch(r"[0-9OG]*\d[0-9OG]*[.,;:]?", tok):
        return tok.replace("O", "0").replace("G", "0")
    return tok


def lixo(paragrafos: list[str], words: set[str], ours: Counter) -> str | None:
    """Motivo de descarte por lixo de OCR (ou None). Sai o parágrafo que tem:
    - sinal de OCR (linha, barra, colchete) ou letra colada a dígito (junk, da auditoria de adventist_ocr_audit);
    - sílaba sem vogal que não é palavra conhecida nem abreviação ("kgnw"). Letra solta não conta: iniciais,
      enumerações "(b)" e "e.g." são normais em comentário.
    """
    known = _conhecida(words, ours)
    for p in paragrafos:
        for tok in p.split(" "):
            if not tok or norm(tok) in ABREVIACOES:
                continue
            if junk(tok) or re.search(r"[|~^<>\\{}©]", tok):
                return "lixo_ocr"
            for parte in tok_parts(tok):
                if len(parte) >= 2 and not parte.isdigit() and not known(parte) and not re.search(r"[aeiouy]", parte):
                    return "lixo_ocr"
    return None


# ---- montagem das linhas -----------------------------------------------------

def monta(cfg: Config, texto: str) -> tuple[list[tuple[int, int, str]], Counter]:
    """Linhas (versículo início, versículo fim, texto) de uma obra, com a contagem de descartes."""
    linhas = limpa_linhas(texto, cfg.pagina)
    pares, stats = comentarios(linhas, cfg)
    words = load_dict()
    ours: Counter = Counter()
    for _, _, _, ps in pares:
        for p in junta_paragrafos(ps):
            p = " ".join(corrige_digito_o(tira_nota_colada(t)) for t in p.split(" "))
            ours.update(norm(t) for t in p.split(" ") if norm(t))
    rows: list[tuple[int, int, str]] = []
    for c, v0, v1, ps in pares:
        ps = [" ".join(corrige_digito_o(tira_nota_colada(t)) for t in p.split(" ")) for p in junta_paragrafos(ps)]
        if cfg.sai_primeiro and ps:
            ps = ps[1:]  # primeiro parágrafo: o próprio versículo, citado
        corpo = " ".join(ps)
        if len(corpo) < 40:
            stats["curto"] += 1
            continue
        motivo = lixo(ps, words, ours)
        if motivo:
            stats[motivo] += 1
            continue
        rows.append((vid(cfg.livro, c, v0), vid(cfg.livro, c, v1), f"{cfg.autor} — {cfg.obra}: {corpo}"))
        stats["comentarios"] += 1
    return rows, stats


def main(nome: str) -> None:
    cfg = CONFIGS[nome]
    path = RAW / cfg.source_id / cfg.arquivo
    texto = path.read_text(encoding="utf-8", errors="replace")
    rows, stats = monta(cfg, texto)
    print(f"[{cfg.source_id}] {dict(stats)}")
    with StagingWriter(cfg.source_id) as w:
        w.source(
            kind="commentary",
            title=cfg.obra,
            author=cfg.autor,
            lang="en",
            license="Public Domain",
            license_url="https://creativecommons.org/publicdomain/mark/1.0/",
            url=cfg.url,
            version="archive.org " + cfg.arquivo.replace("_djvu.txt", ""),
            attribution=cfg.atribuicao,
            tradition=cfg.tradicao,
            notes=cfg.notas,
        )
        seen: Counter = Counter()
        for start, end, text in sorted(rows, key=lambda r: (r[0], r[1])):
            base = cite_com(cfg.source_id, start, end)
            seen[base] += 1
            cite = base if seen[base] == 1 else f"{base}.{seen[base]}"
            w.row("commentary", cite_id=cite, start_vid=start, end_vid=end, text=text)


if __name__ == "__main__":
    nomes = sys.argv[1:] or list(CONFIGS)
    for n in nomes:
        main(n)
