"""Ingere obras adventistas em domínio público (Ellen G. White) como comentários por referência.

Cada obra vira uma source 'egw-<slug>' (ou 'smith-daniel'), kind 'commentary', tradition 'adventist'. Estas obras
não são comentários versículo a versículo: só os parágrafos que citam explicitamente versículos
viram linhas. Cada referência inequívoca do parágrafo (ingest/refparse.py) gera uma linha com
cite_id com:<source>:<início>-<fim>. O texto da linha é "Autor — Obra, cap. N" (como a patrística)
seguido do parágrafo inteiro.

Regras:
- Parágrafo sem referência não gera linha. Descartam-se: referência ambígua (abreviação "Phil."
  sem capítulo:versículo, que pode ser Filipenses ou Filemom); intervalo que cobre capítulos inteiros
  (quase sempre leitura errada de "Ps. 68: 10"); e, em scans do archive.org, parágrafo com letra e dígito
  colados (erro de OCR como "2S:19"). A contagem de cada motivo sai no fim da execução.
- Nota de rodapé só de referência ("4 Isa. 53:7.") vai para o parágrafo de prosa anterior. Em Gutenberg
  com notas numeradas ("Footnote 844:" e marcador "[844]"), a nota vai para o parágrafo que tem o marcador.
- Apêndice e índices (back matter) não entram.
- Cabeçalhos de página, ilustrações, marcas de digitalização e o cabeçalho/rodapé do Project
  Gutenberg são removidos antes da divisão em parágrafos.
- Texto em inglês, como nas demais fontes de comentário.

Obras incluídas (todas com publicação anterior a 1929; autora falecida em 1915):
- egw-great-controversy: The Great Controversy (Gutenberg #25833; copyright 1888, 1907, 1911).
- egw-patriarchs: The Story of Patriarchs and Prophets (Gutenberg #79498; copyright 1890, 1913).
- egw-prophets: The Story of Prophets and Kings (archive.org storyofprophetsk0000elle; copyright 1917).
- egw-acts: The Acts of the Apostles (archive.org actsapostlesinp00unkngoog; 1911).
- egw-object-lessons: Christ's Object Lessons (archive.org christsobjectles00whit; copyright 1900).
- egw-steps: Steps to Christ (archive.org stepstochrist00whit; edição de 1896, texto de 1892).
- egw-thoughts: Thoughts from the Mount of Blessing (archive.org thoughtsfrommoun0000unse; impressão de 1928,
  copyright 1900 e 1928; texto de 1896). Comentário do Sermão do Monte.
- smith-daniel: Uriah Smith, Daniel and the Revelation (archive.org danielrevelation00smit_3, Library of Congress;
  1897). Autor falecido em 1903. Estudo versículo a versículo, o único que não é de Ellen G. White.

Descartadas (ver DATA_LICENSES.md):
- The Desire of Ages: os scans de 1898 trazem aviso de direitos de 1940 de edição revisada (archive.org
  desireofages0000elle); titularidade não confirmada.
- Ministry of Healing (1905, archive.org ministryofhealin00whitrich) e Education (1903, archive.org
  education00whitrich e education00whit): o texto vem com uma linha por parágrafo (mediana de 34 a 89
  caracteres), e a frase é cortada no fim da linha. Juntar isso exige reconstruir os parágrafos, o que
  mudaria o texto. A edição de 1905 com aviso de 1942 (ministryofhealin0000elle_r4y1) não serve.
- Geneva Bible Notes e Family Bible Notes: sem licença clara no módulo SWORD nem no scan de archive.org.

Uso:
    cd pipeline && .venv/bin/python -I ingest/adventist_pd.py [egw-steps,egw-acts]
"""

import hashlib
import json
import re
import sys
import urllib.request
from collections import Counter
from difflib import SequenceMatcher
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import RAW, STAGING, StagingWriter, cite_com  # noqa: E402
from ingest.refparse import VERSES, find_refs  # noqa: E402
from sensus.refs import BOOK_BY_NUM  # noqa: E402

UA = "Mozilla/5.0 (sensus-ingest; local research pipeline)"
AUTHOR = "Ellen G. White (1827-1915)"
GUT_LICENSE_URL = "https://www.gutenberg.org/policy/license.html"

# Abreviação "Phil" sem capítulo:versículo (Filemom ou Filipenses): ambígua.
BARE_PHIL = re.compile(r"\bPhil(?:ippians|\.)?\s*\d+(?![\d\s]*[:.]\s*\d)(?!\s*[:.]\s*\d)")
# Marcas de página e digitalização comuns aos scans do archive.org (linhas inteiras).
SCAN_FURNITURE = re.compile(
    r"Digiti[sz]e[cd]?\s+by\s+Google|digital copy of a book|"
    r"^\s*\d{0,4}\s*\[\s*\d[\d\s\-]*\]?.*$|^\s*\d{1,4}\s*$|^\s*\w?\s*$"
)
ILLUSTRATION = re.compile(r"\[Illustration[^\]]*\]", re.S)
GUT_START = re.compile(r"^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG.*$", re.M)
GUT_END = re.compile(r"^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG.*$", re.M)
GUT_ITALIC = re.compile(r"_((?:(?!\n\s*\n)[^_]){1,300}?)_")  # sem cruzar parágrafo
PAGE_BRACKET = re.compile(
    r"(?:\b\d{1,4}\s+(?=\d[\d\s\-]*[\]}]))?[\[{]\s*\d[\d\s\-]*[\]}]?\s*|\d[\d\s\-]*\}\s*")
ROMAN = re.compile(r"^[IVXLC]+$")
# Número romano de capítulo lido errado pelo OCR do scan de 1907 ("IIL" = III, "XVILE" = XVII).
ROMAN_OCR = {"IIL": "III", "XVILE": "XVII"}
TERMINAL = tuple('.!?"”’:;)')


@dataclass(frozen=True)
class Work:
    source_id: str
    title: str          # título da obra (em inglês, como no original)
    short: str          # título curto para o cabeçalho do verbete
    edition: str        # edição usada e data de publicação
    url: str            # página de origem (leitura humana)
    fetch_url: str      # arquivo baixado (texto simples)
    raw_name: str       # nome local do arquivo em data/raw/<source_id>/
    origin: str         # 'gutenberg' ou 'archive'
    running: str        # cabeçalho corrente do scan (regex, sem a numeração de página)
    chapter: str | None  # regex da linha de capítulo (grupo 1 = número/romano)
    rights: str         # justificativa de domínio público, para attribution
    alt: tuple | None = None  # (url, arquivo) de outra digitalização da mesma obra, para corrigir OCR
    # Linha inteira que é cabeçalho/rodapé do scan (título corrente, capítulo de página, número de página).
    # Ao contrário de `running`, não remove a expressão dentro de uma linha de texto.
    furniture: str | None = None
    strict_ocr: bool = False  # marca {} que sobra (sem correspondência) descarta o parágrafo
    # (início, fim) de um bloco a remover do texto: do início até o começo do fim (regex). Usado para o
    # sumário, cujos títulos de capítulo não são de texto e confundiriam a numeração dos capítulos.
    skip: tuple | None = None
    # (regex, capítulo) de capítulos cujo cabeçalho o OCR perdeu: insere "CHAPTER <n>" antes do trecho que casa.
    chapter_heads: tuple = ()
    # Remove legendas de ilustração (título em maiúsculas + citação + "— Page N") e o OCR solto ao redor.
    drop_captions: bool = False
    # Seções encabeçadas por um versículo de Mt 5–7 (epígrafe igual ao texto da KJV): os parágrafos
    # de prosa até a próxima epígrafe são ligados a esse versículo.
    sermon_sections: bool = False
    author: str = AUTHOR
    # Trecho da atribuição sobre o domínio público (autor, falecimento e publicação).
    pd: str = ("Domínio público: autora falecida em 1915 e obra publicada antes de 1929 (domínio "
               "público nos EUA); no Brasil, autora falecida há mais de 70 anos.")


WORKS = [
    Work("egw-great-controversy", "The Great Controversy Between Christ and Satan", "The Great Controversy",
         "Review & Herald, 1911 (copyright 1888, 1907, 1911)",
         "https://www.gutenberg.org/ebooks/25833", "https://www.gutenberg.org/cache/epub/25833/pg25833.txt",
         "pg25833.txt", "gutenberg", r"THE GREAT CONTROVERSY", None,
         "Project Gutenberg eBook #25833"),
    Work("egw-patriarchs", "The Story of Patriarchs and Prophets", "Patriarchs and Prophets",
         "Pacific Press, 1913 (copyright 1890, 1913)",
         "https://www.gutenberg.org/ebooks/79498", "https://www.gutenberg.org/cache/epub/79498/pg79498.txt",
         "pg79498.txt", "gutenberg", r"PATRIARCHS AND PROPHETS", None,
         "Project Gutenberg eBook #79498"),
    Work("egw-prophets", "The Story of Prophets and Kings", "Prophets and Kings",
         "Pacific Press e Review and Herald, 1917 (copyright 1917)",
         "https://archive.org/details/storyofprophetsk0000elle",
         "https://archive.org/download/storyofprophetsk0000elle/storyofprophetsk0000elle_djvu.txt",
         "storyofprophetsk0000elle_djvu.txt", "archive", r"PROPHETS AND KINGS", r"^(?i:chapter)\s+([0-9IVXLl]+)\s*$",
         "Internet Archive storyofprophetsk0000elle"),
    Work("egw-acts", "The Acts of the Apostles in the Proclamation of the Gospel of Jesus Christ", "The Acts of the Apostles",
         "Pacific Press, 1911",
         "https://archive.org/details/actsapostlesinp00unkngoog",
         "https://archive.org/download/actsapostlesinp00unkngoog/actsapostlesinp00unkngoog_djvu.txt",
         "actsapostlesinp00unkngoog_djvu.txt", "archive", r"ACTS OF THE APOSTLES",
         r"^(?i:chapter)\s+([IVXL]+)\s*$", "Internet Archive actsapostlesinp00unkngoog",
         alt=("https://ia600903.us.archive.org/34/items/actsofapostlesin0000elle/actsofapostlesin0000elle_djvu.txt",
              "actsofapostlesin0000elle_djvu.txt")),
    Work("egw-object-lessons", "Christ's Object Lessons", "Christ's Object Lessons",
         "Pacific Press, 1900 (copyright 1900)",
         "https://archive.org/details/christsobjectles00whit",
         "https://archive.org/download/christsobjectles00whit/christsobjectles00whit_djvu.txt",
         "christsobjectles00whit_djvu.txt", "archive", r"CHRIST'?S OBJECT LESSONS", None,
         "Internet Archive christsobjectles00whit (NYPL)",
         alt=("https://archive.org/download/christsobjectles0000unse_h6u4/christsobjectles0000unse_h6u4_djvu.txt",
              "christsobjectles0000unse_h6u4_djvu.txt")),
    Work("egw-steps", "Steps to Christ", "Steps to Christ",
         "Fleming H. Revell, 1892; edição de 1896 (Review and Herald)",
         "https://archive.org/details/stepstochrist00whit",
         "https://archive.org/download/stepstochrist00whit/stepstochrist00whit_djvu.txt",
         "stepstochrist00whit_djvu.txt", "archive", r"STEPS TO CHRIST", None,
         "Internet Archive stepstochrist00whit"),
    Work("egw-thoughts", "Thoughts from the Mount of Blessing", "Thoughts from the Mount of Blessing",
         "Pacific Press, 1928 (copyright 1900, 1928; texto de 1896)",
         "https://archive.org/details/thoughtsfrommoun0000unse",
         "https://archive.org/download/thoughtsfrommoun0000unse/thoughtsfrommoun0000unse_djvu.txt",
         "thoughtsfrommoun0000unse_djvu.txt", "archive", r"(?!)", None,
         "Internet Archive thoughtsfrommoun0000unse (Cincinnati Bible College & Seminary)",
         furniture=r"HOFMANN", strict_ocr=True, drop_captions=True, sermon_sections=True),
    # Digitalização de 1907 (Southern Publishing Association): aspas e travessões do OCR são legíveis.
    # A de 1897 (danielrevelation00smit_3) troca aspas por "4 '", "u" e "' '" e fica fora do build.
    Work("smith-daniel", "Daniel and the Revelation", "Daniel and the Revelation",
         "Southern Publishing Association, 1907 (entrada de 1897; copyright 1907)",
         "https://archive.org/details/danielrevelation0000smit",
         "https://archive.org/download/danielrevelation0000smit/danielrevelation0000smit_djvu.txt",
         "danielrevelation0000smit_djvu.txt", "archive", r"(?!)", r"^CHAPTER\s+([IVXL]+|IIL|XVILE)\s*\.?\s*$",
         "Internet Archive danielrevelation0000smit (Claremont School of Theology)",
         author="Uriah Smith (1832-1903)",
         pd=("Domínio público: autor falecido em 1903 e obra publicada em 1897 (domínio público nos EUA); "
             "no Brasil, autor falecido há mais de 70 anos."),
         skip=(r"^The Book of Daniel\s*$", r"ranking him in this respect"),
         chapter_heads=((r"^Verse 1\. And in the second year of the reign of Nebuchadnezzar", "II"),
                        (r"^Verse 1\. And there came one of the seven angels which had the", "XVII")),
         furniture=(r"THE REVELATION\s*\.?|[£\d\s]*PROPHECY\s+O[FP]\s+DA[NX][EI]L\.?\s*\d*|"
                    r"\d*\s*CHAPTER\.?\s+[0-9IVXL]+,\s+VERSES?\s+[0-9\s\-,]+\.?\s*\d*|APPENDIX\.?|"
                    r"\d*\s*[CO]ONTENTS\.?\s*\d*|\d*\s*PREFACE\s*\d*|Page\.|"
                    r"(?=.*\d)[0-9IOl]{1,4}\.?"), strict_ocr=True),
]


RUNNING_CHAPTER = re.compile(r"^\s*\d*\s*CHAPTER\.?\s+(\d{1,2}),\s+VERSES?\b.*$")


def to_roman(n: int) -> str:
    vals = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    out = ""
    for v, sym in vals:
        while n >= v:
            out += sym
            n -= v
    return out


# Legenda de ilustração do scan: linha com duas ou mais palavras em maiúsculas (título) e, até 4 linhas
# depois, "— Page N". Entre as duas, a citação. Em volta, linhas de OCR solto (ver is_junk).
CAPTION_TITLE = re.compile(r"^[“\"‘]?(?:[A-Z][A-Z’'.,\-]*[ \t]+)+[A-Z][A-Z’'.,\-]*(?:[ \t].*)?$")
CAPTION_END = re.compile(r"—\s*Page\s*\d+")
JUNK_TOKEN = re.compile(r"^(?:[A-Za-z]{1,3}|\d{1,4}|\(\d{1,4}\)|[^\w\s]+)[.,:;?!]*$")


def is_junk(line: str) -> bool:
    """Linha curta de OCR de imagem (palavras de até 3 letras, números, pontuação)."""
    tokens = line.split()
    return 0 < len(tokens) and len(line) <= 30 and all(JUNK_TOKEN.match(t) for t in tokens)


def drop_captions(raw: str) -> str:
    """Troca por linha vazia cada legenda de ilustração e as linhas de OCR solto coladas a ela.

    Linhas vazias entram no lugar, para o parágrafo antes e o depois continuarem separados e
    serem juntados pela regra de continuação (minúscula depois de quebra de página).
    """
    lines = raw.split("\n")
    drop: set[int] = set()
    i = 0
    while i < len(lines):
        if i in drop or not CAPTION_TITLE.match(lines[i]):
            i += 1
            continue
        end = next((k for k in range(i, min(i + 12, len(lines))) if CAPTION_END.search(lines[k])), None)
        if end is None:
            i += 1
            continue
        start, k, n = i, i - 1, 0
        while k >= 0 and n < 6 and (not lines[k].strip() or is_junk(lines[k].strip())):
            n += bool(lines[k].strip())
            start = k
            k -= 1
        k, n = end + 1, 0
        while k < len(lines) and n < 6 and (not lines[k].strip() or is_junk(lines[k].strip())):
            n += bool(lines[k].strip())
            end = k
            k += 1
        drop.update(range(start, end + 1))
        i = end + 1
    return "\n".join("" if idx in drop else ln for idx, ln in enumerate(lines))


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url: str, dest: Path) -> Path:
    """Baixa url para dest (idempotente)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 16):
            f.write(chunk)
    tmp.rename(dest)
    return dest


SOFT_HYPHEN = re.compile(r"¬\s*")  # hífen de fim de linha do OCR (DLI): "pict¬ured" -> "pictured"
BACK_MATTER = re.compile(r"^\s*(?:APPENDIX|INDEX)\b[A-Z .,]*\.?\s*$", re.M)


def cut_back_matter(raw: str) -> str:
    """Corta apêndice e índices (notas e índice remissivo, não o texto da obra).

    Procura o título depois de 15% do texto, para não confundir com o sumário.
    """
    for m in BACK_MATTER.finditer(raw):
        if m.start() > 0.15 * len(raw):
            return raw[:m.start()]
    return raw


def read_body(work: Work, path: Path) -> tuple[str, dict[int, str]]:
    """Corpo do texto e notas de rodapé numeradas (Gutenberg: "Footnote 844:" com marcador "[844]").

    Remove cabeçalho/rodapé do Gutenberg, ilustrações, marcas de scan e cabeçalhos correntes.
    """
    raw = path.read_bytes().decode("utf-8", errors="replace").replace("\r", "")
    if work.origin == "gutenberg":
        m, e = GUT_START.search(raw), GUT_END.search(raw)
        if not m or not e:
            raise RuntimeError(f"{work.source_id}: marcadores START/END do Gutenberg não encontrados")
        raw = raw[m.end():e.start()]
        raw = GUT_ITALIC.sub(r"\1", raw)  # marcação de itálico do Gutenberg: _palavra_
    if work.skip:
        start, end = (re.compile(p, re.M) for p in work.skip)
        m = start.search(raw)
        e = end.search(raw, m.end()) if m else None
        if m and e:
            raw = raw[:m.start()] + raw[e.start():]
    for pat, roman in work.chapter_heads:
        raw = re.sub(pat, lambda m, r=roman: f"\n\nCHAPTER {r}\n\n" + m.group(0), raw, count=1, flags=re.M)
    raw = ILLUSTRATION.sub("", raw)
    if work.drop_captions:
        raw = drop_captions(raw)
    raw = cut_back_matter(raw)
    raw = SOFT_HYPHEN.sub("", raw)
    head = work.running.replace(" ", r"\s+")  # o scan tem espaço duplo entre as palavras
    furn = re.compile(work.furniture) if work.furniture else None
    running = re.compile(r"^\s*(?:\d+\s+)?" + head + r"(?:\s+\d+)?\s*\.?\s*$", re.I)
    inline_running = re.compile(r"\s*\b\d*\s*\b" + head + r"\b\s*\d*", re.I)
    footnotes: dict[int, str] = {}
    kept, note = [], None
    for ln in raw.split("\n"):
        fn = FOOTNOTE_HEAD.match(ln)
        if fn:
            note = int(fn.group(1))
            footnotes[note] = ""
            continue
        if note is not None:
            if not ln.strip() or ln.startswith(" "):
                footnotes[note] += " " + ln.strip()
                continue
            note = None
        ch = RUNNING_CHAPTER.match(ln)
        if ch:  # cabeçalho corrente "CHAPTER 2, VERSES 1-4 33": a página é do capítulo 2 (numeração arábica)
            kept += ["", f"CHAPTER {to_roman(int(ch.group(1)))}", ""]
            continue
        if furn and furn.fullmatch(" ".join(ln.split())):
            kept.append("")  # cabeçalho de página inteiro na linha: separa, sem colar parágrafos
            continue
        if running.match(ln) or (SCAN_FURNITURE.search(ln) and ln.strip()):
            kept.append("")  # linha de página: separa, sem colar parágrafos
            continue
        kept.append(inline_running.sub(" ", ln))
    return "\n".join(kept), {k: " ".join(v.split()) for k, v in footnotes.items()}


def paragraphs(body: str, work: Work):
    """Gera (capítulo ou None, parágrafo) na ordem do livro.

    Parágrafos separados por linha em branco. Parágrafo que continua o anterior depois de uma
    quebra de página (começa em minúscula e o anterior não termina em pontuação) é colado a ele.
    """
    chapter = None
    buf: list[str] = []
    out: list[tuple[str | None, str]] = []

    def flush():
        if not buf:
            return
        text = " ".join(" ".join(buf).split())
        buf.clear()
        if not text:
            return
        if work.origin == "archive" and is_sidehead(text) and not (work.chapter and re.match(work.chapter, text)):
            return  # título de página ("THE CALL OF ISAIAH") no meio da frase; o texto continua
        if work.origin == "archive":
            text = text.replace("^", "")
            text = re.sub(r"(?<=\s)_+(?=\s)", "", text)  # traço isolado do scan (não é palavra)
            text = PAGE_BRACKET.sub("", text)  # número de página entre colchetes colado ao texto: "[ 3671 359 hearts"
            text = re.sub(r"(?<=[a-z])- (?=[a-z])", "", text)  # "Ju- daism" -> "Judaism"
            text = " ".join(text.split())
            text = FOOTNOTE_NUM.sub(_drop_footnote_num, text)
        if out and re.match(r"[\"“‘']*[a-z]", text) and out[-1][0] == chapter:
            merged = out[-1][1] + " " + text
            if work.origin == "archive":  # hífen que caiu entre duas partes (página em branco no meio)
                merged = re.sub(r"(?<=[a-z])- (?=[a-z])", "", merged)
            out[-1] = (out[-1][0], merged)
            return
        out.append((chapter, text))

    for ln in body.split("\n") + [""]:
        if ln.strip():
            buf.append(ln.strip())
            continue
        flush()
        if not out:
            continue
        text = out[-1][1]
        if work.chapter:
            m = re.match(work.chapter, text)
            if m and out[-1][0] == chapter:
                token = ROMAN_OCR.get(m.group(1), m.group(1))
                chapter = "I" if token == "l" else token.upper() if ROMAN.match(token.upper()) else token
                out.pop()
    return out


# Lista de referências (rodapé de página, "Isa. 14:13, 14; Eze. 28:18, 19."): sem prosa.
REF_LIST = re.compile(r"(?:[1-3]\s)?[A-Z][A-Za-z]*\.?\s*\d+(?:\s*:\s*\d+)?(?:\s*[-–,;]\s*\d+(?:\s*:\s*\d+)?)*")
# "Isa. 5 : 3-7" -> "Isa. 5:3-7" (espaço antes/depois do dois-pontos do scan).
COLON_SPACES = re.compile(r"(\d)\s*:\s*(\d)")
FOOTNOTE_HEAD = re.compile(r"^Footnote (\d+):\s*$")
# Nota numerada colada no texto (OCR): "again .” 1 Signs". Não mexe em "”  2 Peter 1:21" (livro bíblico).
FOOTNOTE_NUM = re.compile(r"([”’\"])\s+\d{1,2}\s+(?=([A-Z“‘][A-Za-z]*))")
BOOK_FIRST = {w.lower().strip(".") for b in BOOK_BY_NUM.values() for w in b[3].split()
              if w.lower() not in ("1", "2", "3", "i", "ii", "iii", "the", "of", "and")} | {"song"}


def _drop_footnote_num(m: re.Match) -> str:
    return m.group(0) if m.group(2).lower() in BOOK_FIRST else m.group(1) + " "
MARKER = re.compile(r"\[(\d{1,4})\]")
PAGE_NUM = re.compile(r"^\d{1,4}\s+(?=(?:Ibid|[a-z\"“‘]))")


# Erro típico de OCR perto de números ("2S:19", "2]viark'i4", "2Eze"): letra colada a dígito.
OCR_JUNK = re.compile(r"[A-Za-z]\d|\d[A-Za-z]")
ORDINAL = re.compile(r"\b\d+(?:st|nd|rd|th)\b")


# Sinais de OCR ruim que a limpeza não corrige: marca {} que sobrou, símbolos de linha, "i"/"j" solto
# (no lugar de palavra), vírgula ou ponto colado a dígito de nota ("years,1").
STRICT_OCR = re.compile(r"[{}|~^\\<>]|(?<=\s)[ij](?=\s)|[A-Za-z][,;]\d")


# Aspas do OCR de scan de 1928/1907: "‘‘" é aspas duplas de abertura; "’’" é de fechamento. Só pontuação:
# a palavra não muda. "Tt" (por "It") é erro de letra, não de pontuação: o parágrafo sai.
OCR_OPEN_DQ = re.compile(r"‘‘\s*")
OCR_CLOSE_DQ = re.compile(r"’’")
OCR_TT = re.compile(r"\bTt\b")


def fix_ocr_quotes(text: str) -> str:
    """Restaura só as aspas duplas que o OCR dividiu em dois apóstrofos (ver DATA_LICENSES.md)."""
    return OCR_CLOSE_DQ.sub("”", OCR_OPEN_DQ.sub("“", text))


def has_ocr_junk(text: str) -> bool:
    """Parágrafo com letra e dígito colados (fora ordinais): OCR de scan, referência não confiável."""
    return bool(OCR_JUNK.search(ORDINAL.sub("", text)))


def is_sidehead(text: str) -> bool:
    """Título de página do scan: só maiúsculas (aceita aspas), com pelo menos duas palavras."""
    letters = re.sub(r"[^A-Za-z]", "", text)
    return len(letters) >= 6 and letters.isupper() and len(text.split()) <= 12


def load_alt(work: Work) -> str:
    """Texto de outra digitalização da mesma obra, normalizado em espaços ('' se não houver)."""
    if not work.alt:
        return ""
    url, name = work.alt
    path = fetch(url, RAW / work.source_id / name)
    if path.stat().st_size < 100_000:
        path.unlink()
        raise RuntimeError(f"{work.source_id}: download da digitalização alternativa falhou (resposta curta)")
    return " ".join(path.read_text(encoding="utf-8", errors="replace").split())


def repair_tokens(para: str, alt: str) -> tuple[str, int, int]:
    """Troca cada palavra com marca de OCR ({, }) pela palavra da outra digitalização.

    Só se as quatro palavras anteriores ocorrem iguais no outro scan e a palavra seguinte é limpa
    e única. Não inventa nada: sem correspondência única, a palavra fica.
    Retorna (texto, corrigidas, sem correspondência).
    """
    toks = para.split(" ")
    fixed = unresolved = 0
    for i, tok in enumerate(toks):
        if not re.search(r"[{}]", tok):
            continue
        if i < 4 or any(re.search(r"[{}]", t) for t in toks[i - 4:i]):
            unresolved += 1
            continue
        pat = r"\s+".join(re.escape(t) for t in toks[i - 4:i]) + r"\s+(\S+)"
        hits = set(re.findall(pat, alt))
        clean = [h for h in hits if not re.search(r"[{}^\\|]|\d[A-Za-z]|[A-Za-z]\d", h)]
        if len(hits) == 1 and len(clean) == 1:
            toks[i] = clean[0]
            fixed += 1
        else:
            unresolved += 1
    return " ".join(toks), fixed, unresolved


def is_prose(text: str) -> bool:
    """Parágrafo de prosa: pelo menos 4 palavras minúsculas fora das referências."""
    return len(re.findall(r"\b[a-z]{4,}\b", REF_LIST.sub(" ", text))) >= 4


def is_whole_chapter(s: int, e: int) -> bool:
    """True se o intervalo cobre capítulos inteiros (ex.: 'Ps. 68: 10' lido como Salmo 68 inteiro)."""
    b, c, v = s // 1_000_000, (s // 1000) % 1000, s % 1000
    ce, ve = (e // 1000) % 1000, e % 1000
    return v == 1 and ce == c and ve == VERSES[b][c - 1]


SERMON = (40005001, 40007029)  # Mateus 5–7 (vid = livro·capítulo·versículo)


def load_kjv(lo: int, hi: int) -> list[tuple[int, str]]:
    """(vid, texto normalizado) dos versículos da KJV no intervalo, da staging de sword_kjv."""
    out = []
    with open(STAGING / "kjv" / "verse_text.jsonl", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if lo <= r["vid"] <= hi:
                out.append((r["vid"], norm_words(r["text"])))
    return out


def norm_words(text: str) -> str:
    return " " + " ".join(re.findall(r"[a-z0-9]+", text.lower())) + " "


QUOTE = re.compile(r"[“\"]([^”\"]+)[”\"]")


def epigraph_vid(para: str, verses: list[tuple[int, str]]) -> int | None:
    """Versículo de Mt 5–7 que é a epígrafe do parágrafo (texto da KJV, igual ou quase igual).

    Epígrafe: o parágrafo é a citação (entre aspas ou inteira), com no máximo 12 palavras fora
    das aspas ("He opened His mouth ... saying, Blessed are ..."). Casa se o versículo está dentro
    da citação (exato, após normalizar pontuação e caixa) ou se a citação tem o mesmo tamanho do
    versículo e pelo menos 90% de semelhança (ex.: "Whosoever shall break" sem "therefore"), ou se a
    citação é um trecho contínuo do versículo, com pelo menos 25 caracteres (ex.: "After this manner therefore pray ye.").
    Prosa que cita o versículo no meio do texto tem mais de 12 palavras fora das aspas e não casa.
    """
    quotes = QUOTE.findall(para)
    outside = QUOTE.sub(" ", para) if quotes else ""
    if len(norm_words(outside).split()) > 12:
        return None
    cands = [norm_words(q) for q in quotes] or [norm_words(para)]
    best = None
    for vid, vn in verses:
        if len(vn.strip()) < 20 or (best is not None and vid >= best):
            continue
        for qn in cands:
            if vn in qn or (0.85 <= len(qn) / len(vn) <= 1.15
                            and SequenceMatcher(None, qn, vn).ratio() >= 0.9) or (
                    len(qn.strip()) >= 25 and qn.strip() in vn):
                best = vid
                break
    return best


def split_epigraph(para: str, verses: list[tuple[int, str]]) -> tuple[int | None, str]:
    """(versículo, resto do parágrafo). Epígrafe no início do parágrafo, colada à prosa do OCR.

    Ex.: "“He opened His mouth ... heaven.” nN SOMETHING strange ..." -> (40005003, "nN SOMETHING ...").
    """
    vid = epigraph_vid(para, verses)
    if vid is not None:
        return vid, ""
    m = re.match(r"\s*[“\"][^”\"]+[”\"]", para)
    if m:
        vid = epigraph_vid(m.group(0), verses)
        if vid is not None:
            return vid, para[m.end():].strip()
    return None, para


def build_work(work: Work):
    """Lista de (start, end, texto) para uma obra, e contadores.

    Marcador de nota "[844]" liga o parágrafo às referências da nota "Footnote 844" (Gutenberg).
    Nota só de referência ("4 Isa. 53:7.") é anexada ao último parágrafo de prosa, que é o texto
    citado. Referência ambígua (Phil. sem capítulo:versículo) é descartada.
    """
    stats = Counter()
    rows = []
    path = RAW / work.source_id / work.raw_name
    body, notes = read_body(work, path)
    alt = load_alt(work)
    fn_refs = {}
    for n, t in notes.items():
        fn_refs[n] = [] if BARE_PHIL.search(t) else find_refs(COLON_SPACES.sub(r"\1:\2", t))
    items: list[dict] = []
    last_prose = None
    verses = load_kjv(*SERMON) if work.sermon_sections else []
    section = None
    for chapter, para in paragraphs(body, work):
        stats["parágrafos"] += 1
        marks = [int(n) for n in MARKER.findall(para)]
        para = MARKER.sub("", para)
        if "{" in para or "}" in para:
            para, fixed, unresolved = repair_tokens(para, alt) if alt else (para, 0, 0)
            stats["palavras com OCR {} corrigidas pela outra digitalização"] += fixed
            stats["palavras com OCR {} sem correspondência (mantidas)"] += unresolved
        para = PAGE_NUM.sub("", COLON_SPACES.sub(r"\1:\2", para))
        if verses:
            epi, rest = split_epigraph(para, verses)
            if epi is not None:
                section = epi
                stats["seções (epígrafe igual ao texto de Mt 5–7 na KJV)"] += 1
                if not rest:
                    continue
                para = rest
        refs = list(find_refs(para))
        for n in marks:
            refs += [r for r in fn_refs.get(n, []) if r not in refs]
        if not refs and not is_prose(para):
            continue
        if not is_prose(para):
            if last_prose is not None and not BARE_PHIL.search(para) and not (
                    work.origin == "archive" and has_ocr_junk(para)):
                last_prose["refs"] += [r for r in refs if r not in last_prose["refs"]]
                stats["notas só de referência anexadas ao parágrafo anterior"] += 1
            else:
                stats["descartadas: nota ambígua ou com OCR ruim, sem parágrafo anterior"] += len(refs)
            continue
        ocr = (work.origin == "archive" and (has_ocr_junk(para) or bool(OCR_TT.search(para)))) or (
            work.strict_ocr and bool(STRICT_OCR.search(para)))
        if work.origin == "archive":
            para = fix_ocr_quotes(para)
        # "— Page N" que sobrou dentro do parágrafo: legenda cortada pelo scan, com texto misturado.
        ocr = ocr or (work.drop_captions and bool(CAPTION_END.search(para)))
        item = {"chapter": chapter, "para": para, "refs": refs, "ocr": ocr,
                "ambiguous": bool(BARE_PHIL.search(para)) or ocr,
                "section": None if ocr or section is None else section}
        items.append(item)
        last_prose = item
    for it in items:
        head = f"{work.author} — {work.short}"
        if it["chapter"]:
            head += f", cap. {it['chapter']}"
        text = f"{head}\n\n{it['para']}"
        refs = it["refs"]
        if it["section"] is not None:
            # Parágrafo da seção: ligado ao versículo da epígrafe (além das referências do próprio texto).
            rows.append((it["section"], it["section"], text))
            stats["parágrafos ligados à seção (versículo da epígrafe)"] += 1
        if not refs:
            continue
        if it["ambiguous"]:
            key = "OCR (letra e dígito colados, ou sinais de OCR ruim)" if it.get("ocr") \
                else "ambíguas (Phil. sem capítulo:versículo)"
            stats[f"descartadas: {key}"] += len(refs)
            continue
        stats["referências de capítulo inteiro"] += sum(is_whole_chapter(*r) for r in refs)
        for s_, e_ in refs:
            rows.append((s_, e_, text))
        stats["parágrafos com referência"] += 1
        stats["referências"] += len(refs)
    return rows, stats


def ingest(work: Work) -> None:
    path = fetch(work.fetch_url, RAW / work.source_id / work.raw_name)
    digest = sha256_of(path)
    rows, stats = build_work(work)
    print(f"[{work.source_id}] {dict(stats)}")
    with StagingWriter(work.source_id) as w:
        w.source(
            kind="commentary",
            title=work.title,
            author=work.author,
            lang="en",
            license="Public Domain",
            license_url=GUT_LICENSE_URL if work.origin == "gutenberg" else None,
            url=work.url,
            version=f"{work.edition}; arquivo {work.raw_name} sha256 {digest[:16]}",
            attribution=(
                f"{work.title}, {work.author}. {work.edition}. Fonte do texto: {work.rights}"
                + (", sem o cabeçalho e o rodapé da licença do Project Gutenberg" if work.origin == "gutenberg" else "")
                + ". " + work.pd
            ),
            tradition="adventist",
            notes=(
                "Obra não é comentário versículo a versículo: só parágrafos que citam versículos "
                "explicitamente geram linhas (uma por referência inequívoca). O cabeçalho do verbete "
                "traz autor, obra e capítulo. Referências ambíguas (Phil. sem capítulo:versículo) "
                "descartadas. Texto em inglês."
            ),
        )
        seen: Counter = Counter()
        for start, end, text in sorted(rows, key=lambda r: (r[0], r[1])):
            base = cite_com(work.source_id, start, end)
            seen[base] += 1
            cite = base if seen[base] == 1 else f"{base}.{seen[base]}"
            w.row("commentary", cite_id=cite, start_vid=start, end_vid=end, text=text)


def main():
    only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    for work in WORKS:
        if only and work.source_id not in only:
            continue
        ingest(work)


if __name__ == "__main__":
    main()
