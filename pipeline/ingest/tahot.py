"""Ingestor do TAHOT (Translators Amalgamated Hebrew OT, STEPBible.org) - AT hebraico.

Gera dois sources:
  - 'tahot' (kind tokens): uma linha de token por palavra TAHOT (corpus 'hot').
  - 'hbo-wlc' (kind text, derivado do TAHOT): um verse_text por versículo, com as
    palavras hebraicas separadas por espaço, usando a leitura de Leningrado.

Fonte: github.com/STEPBible/STEPBible-Data, CC BY 4.0 (Tyndale House / STEPBible.org).
Arquivos baixados num commit fixo. Uso:
    cd pipeline && .venv/bin/python -I ingest/tahot.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import re  # noqa: E402
import urllib.request  # noqa: E402
from collections import defaultdict  # noqa: E402
from urllib.parse import quote  # noqa: E402

from sensus.refs import book_num, osis_ref, vid as make_vid  # noqa: E402
from sensus.staging import RAW, StagingWriter, cite_tok, cite_txt  # noqa: E402

REPO_SHA = "dd88ab3772971e17c0ec28a5a6e34f2e97c2f848"
RAW_BASE = f"https://raw.githubusercontent.com/STEPBible/STEPBible-Data/{REPO_SHA}/"
REPO_URL = f"https://github.com/STEPBible/STEPBible-Data/tree/{REPO_SHA}/Translators%20Amalgamated%20OT%2BNT"
VERSION = f"{REPO_SHA[:7]} (commit de 2026-10-09)"
LICENSE = "CC-BY-4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
ATTRIBUTION = (
    'Dados criados por STEP Bible (www.STEPBible.org), baseados em trabalho da '
    'Tyndale House Cambridge. Licença CC BY 4.0: credite "STEP Bible" com link para www.STEPBible.org.'
)

TAHOT_FILES = [
    "Translators Amalgamated OT+NT/TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "Translators Amalgamated OT+NT/TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "Translators Amalgamated OT+NT/TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "Translators Amalgamated OT+NT/TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
]
TEHMC_FILE = "Morphology codes/TEHMC - Translators Expansion of Hebrew Morphology Codes - STEPBible.org CC BY.txt"

# Abreviações de livro do TAHOT que não estão em refs.py (alias ausente).
EXTRA_BOOKS = {"joe": 29}  # 'Joe' = Joel

ROW_RE = re.compile(r"^(.+?)#(\d+)=([^\t]*)$")            # Gen.1.1#01=L
REF_RE = re.compile(r"^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?$")  # Psa.22.16(22.17)
TYPE_RE = re.compile(r"^([A-Za-z]+)(?:\((.*)\))?$")       # LAH(b), Q(K), X
MAIN_STRONG_RE = re.compile(r"\{(H\d{4}[A-Za-z]*)\}")     # raiz entre chaves
LEMMA_RE = re.compile(r"\{(H\d{4}[A-Za-z]*)=([^=}]*)=")   # {H7225G=רֵאשִׁית=gloss}
ROOT_RE = re.compile(r"(H\d{4}[A-Za-z]*)")
PUNCT_RE = re.compile(r"[׃׀\s]")                          # sof pasuq, paseq, espaços
SECTION_MARKS = {"פ", "ס"}                                 # petucha / setuma

# Legenda das letras de edição (ver notes da source 'tahot').
EDITION_NOTES = (
    "editions: letras de edição separadas por vírgula. L=Leningrad (base); A=Aleppo; "
    "B=BHS; C=Cairensis; D=manuscrito do Mar Morto/Deserto da Judeia; H=Ben Chaim (2ª Bíblia Rabínica); "
    "P=pontuação alternativa; S=tradições escribais (Itture/Tiqqune Sopherim, Masora); "
    "F=só formatação; Q=Qere (leitura usada pelos tradutores; o Ketiv aparece em variant_note); "
    "K=Ketiv; R=restaurado de paralelos (Jos 21:36-37, Neh 7:67b); "
    "X=palavra acrescentada a partir da LXX (apêndice BHS/BHK, não está no Leningrado); "
    "V=variante de outros manuscritos. Letras fora de parênteses no TAHOT são as edições que "
    "contêm a leitura; letras entre parênteses são variantes (em variant_note). "
    "E=emenda de estudiosos (não é testemunha; só variant_note)."
)


def fetch() -> Path:
    """Baixa os arquivos brutos no commit fixo (idempotente: pula os que já existem)."""
    dest = RAW / "tahot"
    dest.mkdir(parents=True, exist_ok=True)
    for rel in [*TAHOT_FILES, TEHMC_FILE]:
        path = dest / rel.rsplit("/", 1)[1]
        if path.exists() and path.stat().st_size > 0:
            continue
        tmp = path.with_name(path.name + ".part")
        print(f"baixando {path.name}")
        urllib.request.urlretrieve(RAW_BASE + quote(rel, safe="/+"), tmp)
        tmp.rename(path)
    return dest


def load_tehmc(path: Path) -> dict[str, str]:
    """Códigos morfológicos completos do TEHMC -> frase legível (linha seguinte ao código)."""
    lines = [ln.rstrip("\r") for ln in path.read_text(encoding="utf-8-sig").split("\n")]
    start = next(i for i, ln in enumerate(lines) if ln.startswith("FULL MORPHOLOGY CODES"))
    codes: dict[str, str] = {}
    for i in range(start, len(lines) - 1):
        m = re.match(r"^([A-Za-z0-9:]+)\t+Function=", lines[i])
        if not m:
            continue
        phrase = lines[i + 1].strip().strip('"').strip()
        if phrase and not phrase.startswith("Function="):
            codes.setdefault(m.group(1), phrase)
    return codes


def expand_morph(code: str, codes: dict[str, str]) -> str | None:
    """'HR/Ncfsa' -> 'Preposition + Noun (Singular Feminine, Absolute)'.

    No TAHOT só o primeiro segmento traz o prefixo H/A; nos seguintes ele é implícito.
    Se algum segmento não estiver no TEHMC, devolve None.
    """
    segs = [s for s in code.split("/") if s]
    if not segs:
        return None
    lang = segs[0][0] if segs[0][:1] in ("H", "A") else ""
    out = []
    for i, s in enumerate(segs):
        full = lang + s if (i and lang and not s.startswith(lang)) else s
        phrase = codes.get(full)
        if phrase is None:
            return None
        out.append(phrase)
    return " + ".join(out)


def heb_surface(s: str) -> str:
    """Forma da palavra: sem '/' de segmentos, sem pontuação de versículo/parágrafo, sem espaços.

    O maqaf (־) fica, pois faz parte da grafia. Partes separadas por '\\' que são só pontuação saem.
    """
    parts = []
    for p in s.split("\\"):
        p = PUNCT_RE.sub("", p)
        if not p or p in SECTION_MARKS:
            continue
        parts.append(p)
    return "".join(parts).replace("/", "")


def join_words(parts) -> str:
    """Palavras separadas por espaço; após maqaf (־) a palavra seguinte fica colada, como na grafia hebraica."""
    out = ""
    for p in parts:
        if not out:
            out = p
        elif out.endswith("־"):
            out += p
        else:
            out += " " + p
    return out


def clean_translit(s: str) -> str:
    return re.sub(r"[\\/\s]", "", s)


def clean_gloss(s: str) -> str:
    return re.sub(r"\s+", " ", " ".join(x.strip() for x in s.replace("\\", " ").split("/") if x.strip())).strip()


def book_of(abbr: str) -> int:
    try:
        return book_num(abbr)
    except KeyError:
        if abbr.lower() in EXTRA_BOOKS:
            return EXTRA_BOOKS[abbr.lower()]
        raise


def leningrad_form(variant_items: list[str]) -> str | None:
    """Forma do Leningrado, se o TAHOT a registra em 'L=...' (usada para Qere e variantes V)."""
    for item in variant_items:
        m = re.match(r"^L=\s*(.*)$", item)
        if not m:
            continue
        seg = m.group(1)
        if "(" in seg:  # 'L= translit (heb) "gloss"'
            a = seg.index("(") + 1
            seg = seg[a: seg.index(")", a)] if ")" in seg[a:] else seg[a:]
        seg = seg.split(' "')[0]
        form = heb_surface(seg)
        return form or None
    return None


def parse_word(cols: list[str], stats: dict, codes: dict[str, str]) -> dict | None:
    m = ROW_RE.match(cols[0])
    if not m:
        return None
    ref, num, typ = m.groups()
    rm = REF_RE.match(ref)
    if not rm:
        raise ValueError(f"referência inesperada: {ref!r}")
    abbr, ch, vs, hch, hvs = rm.groups()
    book = book_of(abbr)
    v = make_vid(book, int(ch), int(vs))
    alt_ref = None
    hkey = v  # versículo hebraico: ordena palavras quando um versículo inglês junta dois hebraicos
    if hch is not None and (int(hch), int(hvs)) != (int(ch), int(vs)):
        hkey = make_vid(book, int(hch), int(hvs))
        alt_ref = osis_ref(hkey)

    # Número da palavra: 2 dígitos = palavra L; 4 dígitos = âncora(2) + sub-índice(2) (X/R inseridas).
    if len(num) == 2:
        anchor, sub = int(num), 0
    elif len(num) == 4:
        anchor, sub = int(num[:2]), int(num[2:])
    else:
        raise ValueError(f"número de palavra inesperado: {ref}#{num}")

    tm = TYPE_RE.match(typ)
    if not tm:
        raise ValueError(f"tipo de texto inesperado: {typ!r}")
    letters = tm.group(1)
    base = letters[0]
    editions = ",".join(letters)

    main = MAIN_STRONG_RE.search(cols[4])
    if main:
        strong = main.group(1)
    else:
        rt = ROOT_RE.match(cols[8])
        strong = rt.group(1) if rt else None
        stats["strong_fallback"] += 1
    if strong is None:
        stats["no_strong"] += 1
    strong_base = strong[:5] if strong else None
    lemma = None
    if strong:
        for lm in LEMMA_RE.finditer(cols[11]):
            if lm.group(1) == strong:
                lemma = lm.group(2) or None
                break

    morph = cols[5].strip() or None
    morph_desc = expand_morph(morph, codes) if morph else None
    if morph and morph_desc is None:
        stats["morph_unmapped"] += 1

    variant_items = []
    for col in (cols[6], cols[7]):
        for item in col.split("¦"):
            item = item.strip().strip(";").strip()
            if item:
                variant_items.append(item)
    if typ == "L" and not variant_items:
        note = None
    else:
        note = typ + (": " + "; ".join(variant_items) if variant_items else "")

    # Leitura do Leningrado para o texto do versículo (Qere/variantes V); None se não houver.
    lform = leningrad_form(variant_items) if base in ("Q", "V") else None
    surface = heb_surface(cols[1])
    translit = clean_translit(cols[2]) or None
    gloss = clean_gloss(cols[3]) or None
    if not surface:
        # Qere que omite a palavra (Hebraico vazio, tradução '[ ]'): usa a forma do Leningrado.
        if not lform:
            raise ValueError(f"palavra vazia sem forma L: {ref}#{num}")
        surface, translit, gloss = lform, None, None
        stats["qere_omitted"] += 1

    return {
        "vid": v, "hkey": hkey, "anchor": anchor, "sub": sub, "base": base, "typ": typ,
        "surface": surface, "lform": lform,
        "translit": translit,
        "gloss": gloss,
        "strong": strong, "strong_base": strong_base, "lemma": lemma,
        "morph": morph, "morph_desc": morph_desc,
        "editions": editions, "variant_note": note, "alt_ref": alt_ref,
    }


def main():
    raw = fetch()
    codes = load_tehmc(raw / TEHMC_FILE.rsplit("/", 1)[1])
    stats = defaultdict(int)
    by_vid: dict[int, list[dict]] = defaultdict(list)
    n_lines_words = 0
    for rel in TAHOT_FILES:
        path = raw / rel.rsplit("/", 1)[1]
        for line in path.read_text(encoding="utf-8-sig").split("\n"):
            line = line.rstrip("\r")
            if not line.strip() or line.startswith("#") or line.startswith("Eng (Heb) Ref"):
                continue
            cols = line.split("\t")
            if len(cols) < 12:
                continue
            w = parse_word(cols, stats, codes)
            if w is None:
                stats["unmatched_lines"] += 1
                if stats["unmatched_lines"] <= 3:
                    print("linha não reconhecida (ignorada):", line[:80])
                continue
            n_lines_words += 1
            by_vid[w["vid"]].append(w)

    print(f"palavras lidas: {n_lines_words}; versículos: {len(by_vid)}; "
          f"sem strong: {stats['no_strong']}; strong pela coluna de raízes: {stats['strong_fallback']}; "
          f"morfologia sem mapeamento TEHMC: {stats['morph_unmapped']}")

    with StagingWriter("tahot") as wt, StagingWriter("hbo-wlc") as wv:
        wt.source(
            kind="tokens",
            title="Translators Amalgamated Hebrew OT (TAHOT)",
            author="STEPBible.org (Tyndale House, Cambridge)",
            lang="hbo",
            license=LICENSE,
            license_url=LICENSE_URL,
            url=REPO_URL,
            version=VERSION,
            attribution=ATTRIBUTION,
            notes=(
                "Texto: Leningrado (via WLC/OpenScriptures), corrigido pela STEPBible; "
                "inclui Qere (Q), restaurações (R) e acréscimos da LXX (X). "
                + EDITION_NOTES + " "
                "pos: posição sequencial da palavra no versículo (palavras X são intercaladas após a "
                "palavra âncora, então pos pode ser maior que o número '#NN' do TAHOT em versículos com X). "
                "strong: raiz principal entre chaves (dStrong desambiguado), strong_base sem sufixo; "
                "a string segmentada original (ex.: 'H9003/{H7225G}') não tem coluna no schema e não é guardada. "
                "morph: código ETCBC/OSHB segmentado com '/', como na fonte; morph_desc: frases do TEHMC "
                "unidas por ' + ', ou NULL se algum segmento não estiver no TEHMC. "
                "vid: versificação inglesa (NRSV/KJV); v.0 = títulos dos salmos; alt_ref: versículo hebraico "
                "quando difere. surface: forma com maqaf (־), sem marcas de segmento '/' e sem sof pasuq/setuma. "
                "Usa TAHOT Gen-Deu, Jos-Est, Job-Sng e Isa-Mal, mais TEHMC para morph_desc."
            ),
        )
        wv.source(
            kind="text",
            title="Hebraico do AT (Leningrado, derivado do TAHOT)",
            author="STEPBible.org (derivado de Westminster Leningrad Codex / OpenScriptures)",
            lang="hbo",
            license=LICENSE,
            license_url=LICENSE_URL,
            url=REPO_URL,
            version=VERSION,
            attribution=ATTRIBUTION,
            notes=(
                "derived from TAHOT. Um verse_text por versículo (vid em versificação inglesa), com as "
                "palavras separadas por espaço. Usa a leitura do Leningrado (forma 'L=' do TAHOT quando a palavra "
                "é Qere ou variante V); palavras X (acréscimos da LXX, fora do Leningrado) ficam de fora; "
                "palavras R (restauradas de paralelos, Jos 21:36-37 e Neh 7:67b) entram, pois o Leningrado não "
                "as contém. Sof pasuq (׃), paseq (׀) e setuma/petucha (ס/פ) não entram no texto. "
                "Títulos de salmos ficam em v.0."
            ),
        )

        n_text = n_v0 = 0
        for v in sorted(by_vid):
            words = sorted(by_vid[v], key=lambda w: (w["hkey"], w["anchor"], w["sub"]))
            keys = [(w["hkey"], w["anchor"], w["sub"]) for w in words]
            if len(set(keys)) != len(keys):
                raise AssertionError(f"palavras duplicadas no versículo {v}")
            if v % 1000 == 0:
                n_v0 += 1
            for pos, w in enumerate(words, 1):
                wt.row(
                    "token",
                    cite_id=cite_tok("hot", v, pos),
                    corpus="hot",
                    vid=v,
                    pos=pos,
                    surface=w["surface"],
                    translit=w["translit"],
                    lemma=w["lemma"],
                    strong=w["strong"],
                    strong_base=w["strong_base"],
                    morph=w["morph"],
                    morph_desc=w["morph_desc"],
                    gloss_en=w["gloss"],
                    editions=w["editions"],
                    variant_note=w["variant_note"],
                    alt_ref=w["alt_ref"],
                )
            text = join_words(w["lform"] or w["surface"] for w in words if w["base"] != "X")
            if text:
                wv.row("verse_text", cite_id=cite_txt("hbo-wlc", v), vid=v, text=text)
                n_text += 1
        print(f"verse_text: {n_text} versículos; títulos de salmos (v.0): {n_v0}")


if __name__ == "__main__":
    main()
