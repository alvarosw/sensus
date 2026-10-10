"""Ingestor: STEPBible TAGNT (Translators Amalgamated Greek NT).

Gera duas fontes a partir dos arquivos TAGNT Mat-Jhn / Act-Rev (+ TEGMC para a
expansão dos códigos morfológicos):

  tagnt   (tokens, grc)  uma linha de token por palavra TAGNT (corpus 'gnt').
  grc-tr  (text, grc)    texto do Textus Receptus, derivado do TAGNT: palavras
                         marcadas como presentes em TR, em ordem de pos.

Uso:
    cd pipeline && .venv/bin/python -I ingest/tagnt.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import collections  # noqa: E402
import itertools  # noqa: E402
import re  # noqa: E402
import urllib.request  # noqa: E402

from sensus import refs  # noqa: E402
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
STRONG = re.compile(r"^G\d{4}[A-Z]?$")
STRONG_ANY = re.compile(r"(?<![0-9A-Za-z])G\d{4}[A-Z]?(?![0-9])")
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
    return re.sub(r"\s+", " ", s).strip()


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
    """Atribui vid canônico e pos final.

    TAGNT numera as palavras por versículo NRSV. Quando dois versículos NRSV
    caem no mesmo versículo KJV (ex.: Mat.17.14 + Mat.17.15[17.14]), as posições
    do segundo colidem. Nesse caso (e só nele) as posições do segundo grupo são
    deslocadas pelo máximo já usado, preservando a ordem do texto.
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
            r["final_pos"] = r["pos"] + off[r["vid"]]
            if off[r["vid"]]:
                shifted += 1
            maxused[r["vid"]] = max(maxused.get(r["vid"], 0), r["final_pos"])
    pairs = collections.Counter((r["vid"], r["final_pos"]) for r in rows)
    dup = [k for k, n in pairs.items() if n > 1]
    if dup:
        raise RuntimeError(f"(vid,pos) duplicados após ajuste: {dup[:5]}")
    return shifted


def split_components(s):
    """'G1473=P-1NS + G2532=CONJ' -> [('G1473','P-1NS'), ('G2532','CONJ')]."""
    out = []
    for part in s.split(" + "):
        if "=" in part:
            st, _, val = part.partition("=")
            out.append((st.strip() or None, val.strip()))
        else:
            out.append((None, part.strip()))
    return out


def editions_of(s):
    out = []
    for e in s.split("+"):
        e = re.sub(r"[»«].*$", "", e).strip()  # remove marcas de deslocamento
        if not e:
            continue
        code = ED_MAP.get(e, e)
        if code not in out:
            out.append(code)
    return out


def build_token(r, tegmc):
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

    comps = split_components(f[3])
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
    strong_base = strong[:5]

    morph = " + ".join(morphs)
    descs = [tegmc.get(mo) for mo in morphs]
    morph_desc = " + ".join(descs) if all(descs) else None

    editions = editions_of(f[5])

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

    return {
        "surface": surface,
        "translit": translit,
        "lemma": lemma,
        "strong": strong,
        "strong_base": strong_base,
        "morph": morph,
        "morph_desc": morph_desc,
        "gloss_en": gloss,
        "editions": ",".join(editions),
        "variant_note": "; ".join(note_parts) or None,
        "alt_ref": alt_ref,
        "_editions": editions,
    }


NOTES = (
    "Fonte: TAGNT (Translators Amalgamated Greek NT), arquivos Mat-Jhn e Act-Rev do "
    f"repositório STEPBible-Data @ {SHA[:10]}. Uma linha por palavra. "
    "dStrong -> strong (com sufixo); strong_base sem sufixo. Palavras compostas "
    "(ex.: κἀγώ) usam o Strong da primeira parte e morph 'A + B'. "
    "gloss_en = glosa lexical do TBESG (não a tradução contextual, que deriva da "
    "Berean Study Bible com permissão própria e não foi incluída). "
    "editions: NA27/NA28 -> NA; Tyn -> TH; Byz -> BYZ; demais mantidos como na fonte "
    "(TR, SBL, WH, Treg, KJV, NIV, testemunhas de manuscritos); marcas de deslocamento "
    "(» e «) removidas. "
    "vid: versificação KJV (referência entre [colchetes] quando presente); alt_ref: "
    "referência NRSV (linhas com [..]) ou NA/outras (linhas com (..) ou {..}), "
    "quando diferente. "
    "pos: posição do TAGNT no versículo; SHIFTED linhas tiveram a posição deslocada "
    "por colisão entre versículos NRSV que caem no mesmo versículo KJV. "
    "morph_desc: TEGMC. variant_note: tipo do TAGNT (N/K/O, quando não NKO) e "
    "variantes de sentido/ortografia. Marcadores de layout (¶ ¬) removidos do grego."
)

GRC_TR_NOTES = "derived from TAGNT: words marked as present in TR"


def main():
    for name in FILES:
        fetch(name)
    tegmc = load_tegmc(DIR / "TEGMC.txt")
    rows = load_rows()
    shifted = assign_positions(rows)

    tr_words = collections.defaultdict(list)
    n_fallback = 0
    n_missing_desc = 0
    n_tr = 0
    src_meta = dict(
        author="STEP Bible (www.STEPBible.org), based on work at Tyndale House, Cambridge",
        lang="grc",
        license="CC-BY-4.0",
        license_url=LICENSE_URL,
        url=REPO_URL,
        version=f"commit {SHA}",
        attribution=ATTRIBUTION,
    )

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
            t = build_token(r, tegmc)
            if t["morph_desc"] is None:
                n_missing_desc += 1
            if r.get("fallback"):
                n_fallback += 1
            eds = t.pop("_editions")
            vid = r["vid"]
            pos = r["final_pos"]
            w.row(
                "token",
                cite_id=cite_tok("gnt", vid, pos),
                corpus="gnt",
                vid=vid,
                pos=pos,
                **t,
            )
            if "TR" in eds:
                n_tr += 1
                tr_words[vid].append((pos, t["surface"]))

        for v in sorted(tr_words):
            words = [s for _, s in sorted(tr_words[v])]
            wt.row("verse_text", cite_id=cite_txt("grc-tr", v), vid=v, text=" ".join(words))

    verses = {r["vid"] for r in rows}
    print(
        f"tokens={len(rows)} verses(tagnt)={len(verses)} shifted_pos={shifted} "
        f"strong_fallback={n_fallback} morph_desc_missing={n_missing_desc} "
        f"tr_tokens={n_tr} verses(grc-tr)={len(tr_words)}"
    )


if __name__ == "__main__":
    main()
