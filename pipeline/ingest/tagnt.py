"""Ingestor: STEPBible TAGNT (Translators Amalgamated Greek NT).

Gera duas fontes a partir dos arquivos TAGNT Mat-Jhn / Act-Rev (+ TEGMC para a
expansão dos códigos morfológicos):

  tagnt   (tokens, grc)  uma linha de token por palavra TAGNT (corpus 'gnt'),
                         mais tokens sintéticos para as leituras alternativas
                         (variantes de sentido e de ortografia) cujas edições
                         não estão cobertas pela palavra principal.
  grc-tr  (text, grc)    texto do Textus Receptus, derivado do TAGNT: tokens
                         marcados como presentes em TR, em ordem de pos.

pos = número da palavra TAGNT * 10 (palavra principal) e
      número * 10 + k (k = 1..) para a k-ésima variante sintética logo após ela.

Uso:
    cd pipeline && .venv/bin/python -I ingest/tagnt.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import collections  # noqa: E402
import itertools  # noqa: E402
import re  # noqa: E402
import unicodedata  # noqa: E402
import urllib.request  # noqa: E402

from sensus import refs  # noqa: E402
from sensus.strong import strong_base_or_none as strong_base  # noqa: E402
from sensus.staging import RAW, StagingWriter, cite_tok, cite_txt  # noqa: E402

SHA = "dd88ab3772971e17c0ec28a5a6e34f2e97c2f848"  # master de STEPBible-Data em 2026-10-09
RAWBASE = f"https://raw.githubusercontent.com/STEPBible/STEPBible-Data/{SHA}"
REPO_URL = f"https://github.com/STEPBible/STEPBible-Data/tree/{SHA}"
DIR = RAW / "tagnt"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
ATTRIBUTION = (
    "Data created by www.STEPBible.org based on work at Tyndale House Cambridge "
    "(CC BY 4.0). Credit: \"STEP Bible\" linked to www.STEPBible.org; "
    "source: github.com/STEPBible/STEPBible-Data."
)

FILES = {
    "TAGNT-Mat-Jhn.txt": f"{RAWBASE}/Translators%20Amalgamated%20OT%2BNT/"
                         "TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
    "TAGNT-Act-Rev.txt": f"{RAWBASE}/Translators%20Amalgamated%20OT%2BNT/"
                         "TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
    "TEGMC.txt": f"{RAWBASE}/Morphology%20codes/"
                 "TEGMC%20-%20Translators%20Expansion%20of%20Greek%20Morphhology%20Codes%20-%20STEPBible.org%20CC%20BY.txt",
    "README.md": f"{RAWBASE}/README.md",
}

# Linha de palavra: REF[ (alt) ]#POS=TIPO  (ex.: Mat.17.15[17.14]#01=NKO)
#   [..] = versificação KJV (canônica); (..) = NA; {..} = outras edições.
WORD = re.compile(
    r"^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:([\[({])(\d+\.\d+)[\])}])?#(\d+)=(\S+)$"
)
# Alternativa de sentido: "FORMA (t=TRANSLIT) GLOSA - STRONG=MORFO in: EDIÇÕES"
ALT_MEANING = re.compile(
    r"^(?P<surf>.+?) \((?P<mk>[A-Za-z]+)=(?P<tr>[^)]*)\) (?P<rest>.*) in: (?P<eds>\S+)$"
)
STRONG_ANY = re.compile(r"(?<![0-9A-Za-z])G\d{4}[A-Z]?(?![0-9])")
STRONG = re.compile(r"^G\d{4}[A-Z]?$")
TRANSLIT_RE = re.compile(r"^(.*?)\s*\(([^()]*)\)\s*$")

# Edições: códigos normalizados (demais são mantidos como estão na fonte).
ED_MAP = {"NA27": "NA", "NA28": "NA", "Tyn": "TH", "Byz": "BYZ"}

LAYOUT_MARKS = re.compile(r"[¶¬]")


def fetch(name):
    dest = DIR / name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    DIR.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(FILES[name], timeout=180) as resp, open(tmp, "wb") as fh:
        fh.write(resp.read())
    tmp.rename(dest)
    return dest


def clean_text(s):
    s = LAYOUT_MARKS.sub("", s)
    s = s.replace("̔Ρ", "Ῥ")  # espírito áspero solto antes de Ρ -> Ῥ
    return unicodedata.normalize("NFC", re.sub(r"\s+", " ", s).strip())


def editions_raw(s):
    """'NA28+TR»1+Byz' -> ['NA28', 'TR', 'Byz'] (sem marcas de deslocamento, sem repetição)."""
    out = []
    for e in s.split("+"):
        e = re.sub(r"[»«].*$", "", e).strip()
        if e and e not in out:
            out.append(e)
    return out


def to_codes(raw):
    """Mapeia edições brutas para códigos normalizados, sem repetição."""
    out = []
    for e in raw:
        code = ED_MAP.get(e, e)
        if code not in out:
            out.append(code)
    return out


def load_tegmc(path):
    out = {}
    with open(path, encoding="utf-8-sig") as fh:
        for line in fh:
            f = line.rstrip("\r\n").split("\t")
            if len(f) >= 2 and re.fullmatch(r"[A-Z][A-Z0-9-]*", f[0]) and f[1].startswith("Function="):
                out.setdefault(f[0], f[1][len("Function="):].strip())
    return out


def parse_word(f0):
    m = WORD.match(f0)
    if not m:
        return None
    book, ch, vs, bopen, binner, pos, wtype = m.groups()
    main = (book, int(ch), int(vs))
    if bopen == "[":  # KJV: versificação canônica; a referência NRSV vira alt_ref
        c2, v2 = map(int, binner.split("."))
        return {"key": main, "canon": (book, c2, v2), "alt": main, "pos": int(pos), "wtype": wtype}
    alt = None
    if bopen:  # NA ( ) ou outras { }: canônica = referência principal
        c2, v2 = map(int, binner.split("."))
        alt = (book, c2, v2)
    return {"key": main, "canon": main, "alt": alt, "pos": int(pos), "wtype": wtype}


def vid_of(t):
    return refs.vid(refs.book_num(t[0]), t[1], t[2])


def load_rows():
    rows = []
    for name in ("TAGNT-Mat-Jhn.txt", "TAGNT-Act-Rev.txt"):
        with open(fetch(name), encoding="utf-8-sig") as fh:
            for line in fh:
                f = line.rstrip("\r\n").split("\t")
                if not f or not f[0]:
                    continue
                r = parse_word(f[0])
                if r is None:
                    continue
                r["f"] = f
                rows.append(r)
    return rows


def assign_positions(rows):
    """Atribui vid canônico e número de palavra final (em unidades de palavra).

    TAGNT numera as palavras por versículo NRSV. Quando dois versículos NRSV
    caem no mesmo versículo KJV (ex.: Mat.17.14 + Mat.17.15[17.14]), os números
    do segundo colidem. Nesse caso o segundo grupo é deslocado pelo máximo já
    usado, preservando a ordem do texto.
    """
    maxused = {}
    shifted = 0
    seen_keys = set()
    for key, grp in itertools.groupby(rows, key=lambda r: r["key"]):
        if key in seen_keys:
            raise RuntimeError(f"versículo NRSV não contíguo na fonte: {key}")
        seen_keys.add(key)
        grp = list(grp)
        gmin = {}
        for r in grp:
            r["vid"] = vid_of(r["canon"])
            gmin[r["vid"]] = min(gmin.get(r["vid"], 10**9), r["pos"])
        off = {v: (maxused[v] if v in maxused and gmin[v] <= maxused[v] else 0) for v in gmin}
        for r in grp:
            r["word_pos"] = r["pos"] + off[r["vid"]]
            if off[r["vid"]]:
                shifted += 1
            maxused[r["vid"]] = max(maxused.get(r["vid"], 0), r["word_pos"])
    pairs = collections.Counter((r["vid"], r["word_pos"]) for r in rows)
    dup = [k for k, n in pairs.items() if n > 1]
    if dup:
        raise RuntimeError(f"(vid,palavra) duplicados após ajuste: {dup[:5]}")
    return shifted


def paragraph_starts(rows):
    """Inícios de parágrafo: ({vid: nº de ¶}, total de ¶, ¶ no meio de versículo).

    O ¶ vem colado à última palavra do parágrafo (coluna grega) e a palavra seguinte abre o novo,
    então o parágrafo começa no vid dela. Um ¶ na última palavra do livro não gera início.
    """
    starts = collections.Counter()
    marks = mid = 0
    for a, b in zip(rows, rows[1:]):
        if "¶" not in a["f"][1]:
            continue
        marks += 1
        if a["canon"][0] != b["canon"][0]:
            continue
        starts[b["vid"]] += 1
        if a["vid"] == b["vid"]:
            mid += 1
    return starts, marks, mid


def split_strong_morph(s):
    """'G1199=N-DPM + G0846|G3165«G3450=P-1GS' -> [('G1199','N-DPM'), ('G3450','P-1GS')].

    Em partes com alternativas ('G0846|G3165«G3450'), vale o último G-número
    (é o que precede o '=' e corresponde ao morfema).
    """
    out = []
    for comp in s.split(" + "):
        comp = comp.strip()
        if "=" in comp:
            st, _, mo = comp.partition("=")
            nums = STRONG_ANY.findall(st)
            out.append((nums[-1] if nums else None, mo.strip()))
        else:
            out.append((None, comp))
    return out


def parse_meaning_alts(s):
    alts = []
    if not s.strip():
        return alts
    for alt in s.split(" ¦ "):
        m = ALT_MEANING.match(alt.strip())
        if not m:
            raise ValueError(f"alternativa de sentido não reconhecida: {alt!r}")
        rest = m.group("rest")
        i = rest.rfind(" - ")
        if i < 0:
            raise ValueError(f"alternativa sem código gramatical: {alt!r}")
        gloss, codes = rest[:i], rest[i + 3:]
        alts.append({
            "surface": clean_text(m.group("surf")),
            "translit": m.group("tr").strip() or None,
            "gloss": clean_text(re.sub(r"[<>]", "", gloss)) or None,
            "comps": split_strong_morph(codes),
            "eds": editions_raw(m.group("eds")),
        })
    return alts


def parse_spelling_alts(s):
    segs = []
    for seg in s.split(";"):
        seg = seg.strip().lstrip("+").strip()
        if not seg:
            continue
        e, sep, form = seg.partition(":")
        if not sep:
            raise ValueError(f"variante ortográfica não reconhecida: {seg!r}")
        segs.append({"surface": clean_text(form), "eds": editions_raw(e)})
    return segs


def build_token_fields(r, tegmc, lemma_map):
    """Campos da palavra principal + listas de variantes sintéticas."""
    f = r["f"]
    m = TRANSLIT_RE.match(f[1])
    if not m:
        raise ValueError(f"grego sem transliteração: {f[1]!r}")
    surface = clean_text(m.group(1))
    translit = m.group(2).strip() or None
    if not surface:
        raise ValueError(f"superfície vazia: {f}")

    lemmas, glosses = [], []
    for part in f[4].split(" + "):
        a, _, b = part.partition("=")
        lemmas.append(a.strip())
        glosses.append(b.strip())
    lemma = " + ".join(lemmas)
    gloss = " + ".join(glosses) or None

    comps = split_strong_morph(f[3])
    primary, morphs = comps[0][0], [mo for _, mo in comps]
    note_parts = []
    if primary and STRONG.match(primary):
        strong = primary
    else:
        alt = STRONG_ANY.findall(f[12])
        if not alt:
            raise ValueError(f"dStrong inválido sem alternativa: {f[3]!r}")
        strong = alt[0]
        note_parts.append(f"dStrong {primary} na fonte é inválido; strong vem de Alt Strongs")
        r["fallback"] = True

    morph = " + ".join(morphs)
    descs = [tegmc.get(mo) for mo in morphs]
    morph_desc = " + ".join(descs) if all(descs) else None

    # Edições da forma principal: as da coluna 'editions' menos as edições em
    # que a grafia principal é substituída por uma variante ortográfica.
    main_raw = editions_raw(f[5])
    spelling = parse_spelling_alts(f[7])
    spelled = {e for seg in spelling for e in seg["eds"]}
    form_raw = [e for e in main_raw if e not in spelled]
    if not form_raw:
        form_raw = main_raw
        r["no_form_eds"] = True

    if r["wtype"] != "NKO":
        note_parts.insert(0, f"tipo {r['wtype']}")
    mv = clean_text(f[6])
    if mv:
        note_parts.append(f"variante de sentido: {mv}")
    sv = clean_text(f[7])
    if sv:
        note_parts.append(f"variante ortográfica: {sv}")

    alt_ref = None
    if r["alt"] is not None:
        alt_v = vid_of(r["alt"])
        if alt_v != r["vid"]:
            alt_ref = refs.osis_ref(alt_v)

    main = {
        "surface": surface,
        "translit": translit,
        "lemma": lemma,
        "strong": strong,
        "strong_base": strong_base(strong),
        "morph": morph,
        "morph_desc": morph_desc,
        "gloss_en": gloss,
        "editions": ",".join(to_codes(form_raw)),
        "variant_note": "; ".join(note_parts) or None,
        "alt_ref": alt_ref,
    }

    synth = []
    # Alternativas de sentido: emitir para as edições que a palavra principal não cobre.
    for alt in parse_meaning_alts(f[6]):
        uncovered = [e for e in alt["eds"] if e not in main_raw]
        if not uncovered:
            continue
        s_strong = alt["comps"][0][0]
        s_morphs = [mo for _, mo in alt["comps"]]
        s_descs = [tegmc.get(mo) for mo in s_morphs]
        synth.append({
            "surface": alt["surface"],
            "translit": alt["translit"],
            "lemma": lemma_map.get(strong_base(s_strong)) if s_strong else None,
            "strong": s_strong,
            "strong_base": strong_base(s_strong) if s_strong else None,
            "morph": " + ".join(s_morphs),
            "morph_desc": " + ".join(s_descs) if all(s_descs) else None,
            "gloss_en": alt["gloss"],
            "editions": ",".join(to_codes(uncovered)),
            "variant_note": f"variante de {surface} (#{r['pos']:02d})",
            "alt_ref": alt_ref,
        })
    # Variantes ortográficas: a grafia de cada grupo de edições.
    for seg in spelling:
        synth.append({
            "surface": seg["surface"],
            "translit": None,
            "lemma": main["lemma"],
            "strong": main["strong"],
            "strong_base": main["strong_base"],
            "morph": main["morph"],
            "morph_desc": main["morph_desc"],
            "gloss_en": main["gloss_en"],
            "editions": ",".join(to_codes(seg["eds"])),
            "variant_note": f"variante ortográfica de {surface} (#{r['pos']:02d})",
            "alt_ref": alt_ref,
        })
    return main, synth


NOTES = (
    "Fonte: TAGNT (Translators Amalgamated Greek NT), arquivos Mat-Jhn e Act-Rev do "
    f"repositório STEPBible-Data @ {SHA[:10]}. Uma linha por palavra TAGNT, mais tokens "
    "sintéticos para leituras alternativas (variantes de sentido e de ortografia) nas "
    "edições que a palavra principal não cobre (variant_note 'variante de ...'). "
    "dStrong -> strong (com sufixo); strong_base sem sufixo. Palavras compostas "
    "(ex.: κἀγώ) usam o Strong da primeira parte e morph 'A + B'. "
    "gloss_en = glosa lexical do TBESG na palavra principal; nas variantes sintéticas, "
    "a glosa da própria variante (TAGNT). "
    "editions: NA27/NA28 -> NA; Tyn -> TH; Byz -> BYZ; demais mantidos como na fonte "
    "(TR, SBL, WH, Treg, KJV, NIV, testemunhas de manuscritos); marcas de deslocamento "
    "(» e «) removidas. A forma principal não lista as edições em que a grafia foi "
    "substituída por variante ortográfica. Cobertura comparada nas edições brutas "
    "(NA27 e NA28 se distinguem antes do mapeamento para NA). "
    "vid: versificação KJV (referência entre [colchetes] quando presente); alt_ref: "
    "referência NRSV (linhas com [..]) ou NA/outras (linhas com (..) ou {..}), "
    "quando diferente. "
    "pos: número da palavra TAGNT * 10 (principal) e * 10 + k (variantes sintéticas); "
    "SHIFTED palavras tiveram o número deslocado por colisão entre versículos NRSV que "
    "caem no mesmo versículo KJV. "
    "morph_desc: TEGMC. variant_note: tipo do TAGNT (N/K/O, quando não NKO) e "
    "variantes de sentido/ortografia. Marcadores de layout (¶ ¬) removidos; grafias "
    "normalizadas para NFC. "
    "text_division (kind 'paragraph'): o ¶ da coluna grega fecha um parágrafo e a palavra seguinte o "
    "abre; a divisão vai ao vid dessa palavra. Os ¶ no meio de um versículo abrem parágrafo nesse "
    "versículo (granularidade do schema: vid). O README do TAGNT não define o ¶ nem diz de qual edição "
    "ele vem; a marca é a do próprio layout da fonte (conferido: ¶ após Mt 4:25 e início em Mt 5:1, "
    "o Sermão da Montanha). Títulos de seção não são emitidos. O ¶ isolado de Mt 11:17 não gera nada."
)

GRC_TR_NOTES = "derived from TAGNT: words marked as present in TR"


def main():
    for name in FILES:
        fetch(name)
    tegmc = load_tegmc(DIR / "TEGMC.txt")
    rows = load_rows()
    shifted = assign_positions(rows)
    starts, para_marks, para_mid = paragraph_starts(rows)

    # Lema por Strong, a partir das palavras principais (para variantes sintéticas).
    lemma_count = collections.defaultdict(collections.Counter)
    for r in rows:
        st = split_strong_morph(r["f"][3])[0][0]
        if st and STRONG.match(st):
            lemma_count[strong_base(st)][clean_text(r["f"][4].split("=")[0])] += 1
    lemma_map = {k: c.most_common(1)[0][0] for k, c in lemma_count.items()}

    tr_words = collections.defaultdict(list)
    n_fallback = n_missing_desc = n_tr = n_synth = n_synth_tr = n_no_form = 0
    n_spelling = n_meaning = 0
    max_k = 0
    tr_before = 0
    src_meta = dict(
        author="STEP Bible (www.STEPBible.org), based on work at Tyndale House, Cambridge",
        lang="grc",
        license="CC-BY-4.0",
        license_url=LICENSE_URL,
        url=REPO_URL,
        version=f"commit {SHA}",
        attribution=ATTRIBUTION,
    )

    tok_count = 0
    verses = set()
    with StagingWriter("tagnt") as w, StagingWriter("grc-tr") as wt:
        w.source(
            kind="tokens",
            title="TAGNT - Translators Amalgamated Greek New Testament (STEPBible.org)",
            notes=NOTES.replace("SHIFTED", str(shifted)),
            **src_meta,
        )
        wt.source(
            kind="text",
            title="Textus Receptus (derived from TAGNT)",
            notes=GRC_TR_NOTES,
            **src_meta,
        )
        for r in rows:
            main_t, synth = build_token_fields(r, tegmc, lemma_map)
            if main_t["morph_desc"] is None:
                n_missing_desc += 1
            if r.get("fallback"):
                n_fallback += 1
            if r.get("no_form_eds"):
                n_no_form += 1
            if "TR" in to_codes(editions_raw(r["f"][5])):
                tr_before += 1
            vid = r["vid"]
            base = r["word_pos"] * 10
            verses.add(vid)
            all_tokens = [(base, main_t)] + [(base + k, s) for k, s in enumerate(synth, 1)]
            max_k = max(max_k, len(synth))
            if len(synth) > 9:
                raise RuntimeError(f"mais de 9 variantes em {r['f'][0]}")
            for pos, t in all_tokens:
                eds = t["editions"].split(",")
                w.row("token", cite_id=cite_tok("gnt", vid, pos), corpus="gnt", vid=vid, pos=pos, **t)
                tok_count += 1
                if "TR" in eds:
                    n_tr += 1
                    tr_words[vid].append((pos, t["surface"]))
            n_synth += len(synth)
            for s in synth:
                if "TR" in s["editions"].split(","):
                    n_synth_tr += 1
                if s["variant_note"].startswith("variante ortográfica"):
                    n_spelling += 1
                else:
                    n_meaning += 1

        for vid in sorted(starts):
            w.row("text_division", vid=vid, kind="paragraph", title=None)

        for v in sorted(tr_words):
            words = [s for _, s in sorted(tr_words[v])]
            wt.row("verse_text", cite_id=cite_txt("grc-tr", v), vid=v, text=" ".join(words))

    print(
        f"palavras_tagnt={len(rows)} tokens={tok_count} sinteticos={n_synth} "
        f"(sentido={n_meaning}, ortografia={n_spelling}, com TR={n_synth_tr}) "
        f"max_k={max_k} shifted={shifted} strong_fallback={n_fallback} "
        f"morph_desc_missing={n_missing_desc} no_form_eds={n_no_form}"
    )
    print(
        f"TR tokens: antes={tr_before} depois={n_tr} "
        f"verses(tagnt)={len(verses)} verses(grc-tr)={len(tr_words)}"
    )
    print(
        f"¶={para_marks} inícios de parágrafo={len(starts)} (no meio do versículo={para_mid})"
    )



if __name__ == "__main__":
    main()
