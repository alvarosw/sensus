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
import re
import sys
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import RAW, StagingWriter, cite_com  # noqa: E402
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
         furniture=r"HOFMANN", strict_ocr=True),
    Work("smith-daniel", "Daniel and the Revelation", "Daniel and the Revelation",
         "Review and Herald, 1897 (copyright 1897)",
         "https://archive.org/details/danielrevelation00smit_3",
         "https://archive.org/download/danielrevelation00smit_3/danielrevelation00smit_3_djvu.txt",
         "danielrevelation00smit_3_djvu.txt", "archive", r"(?!)", r"^CHAPTER\s+([IVXL]+)\.?\s*$",
         "Internet Archive danielrevelation00smit_3 (Library of Congress)",
         author="Uriah Smith (1832-1903)",
         pd=("Domínio público: autor falecido em 1903 e obra publicada em 1897 (domínio público nos EUA); "
             "no Brasil, autor falecido há mais de 70 anos."),
         furniture=(r"THE REVELATION\.|PROPHECY\s+O[FP]\s+DA[NX][EI]L\.?|"
                    r"CHAPTER\s+[0-9IVXL]+,\s+VERSES?\s+[0-9\s\-,]+\.?|APPENDIX\.?|CONTENTS\.?|Page\.|"
                    r"(?=.*\d)[0-9IOl]{1,4}\.?"), strict_ocr=True),
]


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
    raw = ILLUSTRATION.sub("", raw)
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
                token = m.group(1)
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
    for chapter, para in paragraphs(body, work):
        stats["parágrafos"] += 1
        marks = [int(n) for n in MARKER.findall(para)]
        para = MARKER.sub("", para)
        if "{" in para or "}" in para:
            para, fixed, unresolved = repair_tokens(para, alt) if alt else (para, 0, 0)
            stats["palavras com OCR {} corrigidas pela outra digitalização"] += fixed
            stats["palavras com OCR {} sem correspondência (mantidas)"] += unresolved
        para = PAGE_NUM.sub("", COLON_SPACES.sub(r"\1:\2", para))
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
        ocr = (work.origin == "archive" and has_ocr_junk(para)) or (
            work.strict_ocr and bool(STRICT_OCR.search(para)))
        item = {"chapter": chapter, "para": para, "refs": refs, "ocr": ocr,
                "ambiguous": bool(BARE_PHIL.search(para)) or ocr}
        items.append(item)
        last_prose = item
    for it in items:
        refs = it["refs"]
        if not refs:
            continue
        if it["ambiguous"]:
            key = "OCR (letra e dígito colados, ou sinais de OCR ruim)" if it.get("ocr") \
                else "ambíguas (Phil. sem capítulo:versículo)"
            stats[f"descartadas: {key}"] += len(refs)
            continue
        keep = refs
        stats["referências de capítulo inteiro"] += sum(is_whole_chapter(*r) for r in refs)
        if not keep:
            continue
        head = f"{work.author} — {work.short}"
        if it["chapter"]:
            head += f", cap. {it['chapter']}"
        text = f"{head}\n\n{it['para']}"
        for s, e in keep:
            rows.append((s, e, text))
        stats["parágrafos com referência"] += 1
        stats["referências"] += len(keep)
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
