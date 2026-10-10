"""Extração de referências bíblicas em texto de dicionários, tópicos e comentários.

find_refs(text) -> list[(start_vid, end_vid)]

Ordem de preferência:
  1. marcação com atributos explícitos: osisRef="Bible:Phil.2.5-Phil.2.8" (TEI/OSIS)
     e passage="nu 26:59" (ThML, SWORD). O elemento inteiro é consumido, de modo
     que o texto visível dele não seja relido pelo regex de prosa (evita falsos
     positivos como "Rev. 1:8</ref>,<ref>11</ref>" lido como Rev 1:11).
  2. prosa: "Phil. 1:1", "Php 2:5-8", "Rom 8:28; 12:1, 2", "Matt. 5:3-12",
     "2 Cor. 5:17", "Ps 23" (capítulo inteiro), "II Kings 3", "Joh 10:7,9; 14:6".
     Continuações ("; 14:6", ", 9") herdam o livro anterior.

Versificação KJV (pysword.canons) é usada para o último versículo de cada capítulo
e para descartar referências inválidas (ex.: "Jude 30").

Ambiguidade "Phil.": a abreviação é de Filipenses (4 capítulos) ou de Filemom (1 capítulo).
"Phil. 2:5" é Filipenses; "Phil. 2" (sem capítulo:versículo) é Filemom, versículo 2
(Smith: "Ápia ... Phil. 2"). "Philem", "Philm" e "Phm" são Filemom (ThML do Smith usa "phm" também
para Filipenses com capítulo 2-4; isso não é resolvido aqui).
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.refs import BOOK_BY_NUM, book_num, vid  # noqa: E402

# pysword traz a versificação KJV canônica (lista de capítulos com nº de versículos).
from pysword.canons import canons  # noqa: E402

_kjv = canons["kjv"]["ot"] + canons["kjv"]["nt"]
assert len(_kjv) == 66
# verses[book][chapter-1] -> nº de versículos
VERSES: dict[int, list[int]] = {}
for _i, _b in enumerate(_kjv, 1):
    assert len(_b[3]) == BOOK_BY_NUM[_i][5], (_b[0], len(_b[3]))
    VERSES[_i] = list(_b[3])

# Códigos de livro da SWORD (ThML do módulo Smith) que não existem em refs.py
# ou que colidem com outro livro (ex.: "jud" é Judges no Smith, não Jude).
SWORD_CODES = {"jud": 7, "joe": 29, "lu": 42, "mr": 41, "so": 22}

_NUMPFX = r"(?:[1-3]\s?|I{1,3}\s|First\s|Second\s|Third\s)"
_STRICT = re.compile(
    r"(?<![A-Za-z0-9])(?P<book>(?:" + _NUMPFX + r")?[A-Z][A-Za-z]*\.?(?:\s+of\s+[A-Z][a-z]+)?)"
    r"\.?\s*(?P<ch>\d{1,3})(?:(?::|\.(?=\d))(?P<v>\d{1,3}))?(?!\d)"
)
_LOOSE = re.compile(
    r"(?<![A-Za-z0-9])(?P<book>(?:" + _NUMPFX + r")?[A-Za-z]+\.?(?:\s+of\s+[A-Za-z]+)?)"
    r"\.?\s*(?P<ch>\d{1,3})(?:(?::|\.(?=\d))(?P<v>\d{1,3}))?(?!\d)"
)
_RANGE = re.compile(r"\s*[-–]\s*(?P<a>\d{1,3})(?:\s*:\s*(?P<b>\d{1,3}))?(?!\d)")
_TAIL_CV = re.compile(r"\s*(?P<sep>[,;])\s*(?P<c>\d{1,3})\s*:\s*(?P<v>\d{1,3})(?!\d)")
_TAIL_N = re.compile(r"\s*(?P<sep>[,;])\s*(?P<n>\d{1,3})(?!\d)(?![:.]\d)")
_BOOK_START = re.compile(r"(?:[1-3]\s?|I{1,3}\s|First\s|Second\s|Third\s)?[A-Z][A-Za-z]*\.?(?:\s+of\s+[A-Z][a-z]+)?")
_OSIS = re.compile(
    r"^(?:Bible:)?(?P<b1>[A-Za-z0-9]+)\.(?P<c1>\d+)(?:\.(?P<v1>\d+))?"
    r"(?:-(?:Bible:)?(?P<b2>[A-Za-z0-9]+)\.(?P<c2>\d+)(?:\.(?P<v2>\d+))?)?$"
)
_ELEM = re.compile(r"<(?P<tag>[A-Za-z][\w-]*)(?P<attrs>\s[^>]*?)?(?:/>|>(?P<inner>.*?)</(?P=tag)>)", re.S)
_ATTR = re.compile(r'(\w+)\s*=\s*"([^"]*)"')
_PLACEHOLDER = "\x01"


# Abreviações usadas na prosa dos dicionários que não estão em refs.py.
PHILIPPIANS = 50
PHILEMON = 57
ABBR = {
    "lu": 42, "mr": 41, "joe": 29, "so": 22, "ze": 36, "habb": 35,
    "philem": PHILEMON, "philm": PHILEMON, "phm": PHILEMON,
}
_NAME_NORM = [(b[0], re.sub(r"[^a-z0-9]", "", b[3].lower())) for b in BOOK_BY_NUM.values()]


def _book(tok: str, extra: dict | None = None) -> int | None:
    t = tok.strip().rstrip(".").strip()
    if not t:
        return None
    if extra and t.lower() in extra:
        return extra[t.lower()]
    try:
        return book_num(t)
    except KeyError:
        pass
    if t.lower() in ABBR:
        return ABBR[t.lower()]
    # Prefixo único do nome inglês (>= 4 letras): "Psal", "Isai", "Numb", "1 Joh".
    key = re.sub(r"[^a-z0-9]", "", t.lower())
    if len(key) >= 4:
        hits = {n for n, name in _NAME_NORM if name.startswith(key)}
        if len(hits) == 1:
            return hits.pop()
    return None


def _book_any(tok: str, extra: dict | None) -> int | None:
    """Tenta o nome inteiro e depois sufixos ('In Psalm' -> 'Psalm')."""
    words = tok.split()
    for i in range(len(words)):
        b = _book(" ".join(words[i:]), extra)
        if b is not None:
            return b
    return None


def _last_verse(b: int, c: int) -> int | None:
    chs = VERSES[b]
    if not 1 <= c <= len(chs):
        return None
    return chs[c - 1]


def _valid_cv(b: int, c: int, v: int) -> bool:
    n = _last_verse(b, c)
    return n is not None and 1 <= v <= n


def _chapter_range(b: int, c1: int, c2: int) -> tuple[int, int] | None:
    if _last_verse(b, c1) is None or _last_verse(b, c2) is None or c2 < c1:
        return None
    return vid(b, c1, 1), vid(b, c2, _last_verse(b, c2))


def _is_bare_phil(book_text: str) -> bool:
    """True se o nome do livro termina na abreviação "Phil" (não "Philippians" nem "Philem")."""
    words = book_text.split()
    return bool(words) and words[-1].rstrip(".").lower() == "phil"


def _starts_book(s: str, i: int) -> bool:
    """True se em s[i:] começa um nome de livro ("1 Cor", "Rom"), e não um número."""
    m = _BOOK_START.match(s, i)
    return bool(m) and _book_any(m.group(0), None) is not None


def _scan(s: str, loose: bool) -> list[tuple[int, int]]:
    """Varre um trecho com referências (prosa ou atributo passage=)."""
    rx = _LOOSE if loose else _STRICT
    extra = SWORD_CODES if loose else None
    out: list[tuple[int, int]] = []
    pos = 0
    while True:
        m = rx.search(s, pos)
        if not m:
            break
        pos = m.end()
        b = _book_any(m.group("book"), extra)
        c = int(m.group("ch"))
        v_txt = m.group("v")
        if v_txt is None and b == PHILIPPIANS and _is_bare_phil(m.group("book")):
            # "Phil. 2" sem ":" é Filemom, versículo 2 (Filemom tem um único capítulo).
            b, c, v_txt = PHILEMON, 1, m.group("ch")
        if b is None or _last_verse(b, c) is None:
            continue
        if v_txt is None:
            kind = "c"  # capítulo inteiro
            items = [(vid(b, c, 1), vid(b, c, _last_verse(b, c)))]
        else:
            kind = "v"
            v = int(v_txt)
            if not _valid_cv(b, c, v):
                continue
            items = [(vid(b, c, v), vid(b, c, v))]

        # Intervalo logo após o primeiro item: "5:3-12", "2:5-3:1", "23-24"
        r = _RANGE.match(s, pos)
        if r:
            pos = r.end()
            a, bb = int(r.group("a")), r.group("b")
            s_start, s_end = items[0]
            if kind == "c":
                rng = _chapter_range(b, c, a)
                if rng:
                    items[0] = (s_start, rng[1])
            elif bb is not None:
                if _valid_cv(b, a, int(bb)):
                    items[0] = (s_start, vid(b, a, int(bb)))
            elif _valid_cv(b, c, a):
                items[0] = (s_start, vid(b, c, a))
        out.extend(items)

        # Continuações na mesma frase, sem nome de livro: "; 14:6", ", 9", "; 3"
        cur_c, cur_kind = c, kind
        while True:
            t = _TAIL_CV.match(s, pos)
            if t:
                nc, nv = int(t.group("c")), int(t.group("v"))
                if not _valid_cv(b, nc, nv):
                    break
                pos = t.end()
                cur_c, cur_kind = nc, "v"
                item = (vid(b, nc, nv), vid(b, nc, nv))
            else:
                t = _TAIL_N.match(s, pos)
                if not t or _starts_book(s, t.start("n")):
                    break
                n = int(t.group("n"))
                pos = t.end()
                if t.group("sep") == "," and cur_kind == "v":
                    if not _valid_cv(b, cur_c, n):
                        break
                    item = (vid(b, cur_c, n), vid(b, cur_c, n))
                else:  # ';' ou vírgula após capítulo inteiro: outro capítulo
                    rng = _chapter_range(b, n, n)
                    if rng is None:
                        break
                    cur_c, cur_kind = n, "c"
                    item = rng
            r = _RANGE.match(s, pos)
            if r:
                pos = r.end()
                a, bb = int(r.group("a")), r.group("b")
                if cur_kind == "c":
                    rng = _chapter_range(b, cur_c, a)
                    if rng:
                        item = (item[0], rng[1])
                elif bb is not None:
                    if _valid_cv(b, a, int(bb)):
                        item = (item[0], vid(b, a, int(bb)))
                elif _valid_cv(b, cur_c, a):
                    item = (item[0], vid(b, cur_c, a))
            out.append(item)
    return out


def _osis(value: str) -> list[tuple[int, int]]:
    out = []
    for tok in value.split():
        m = _OSIS.match(tok)
        if not m:
            continue
        try:
            b1 = book_num(m.group("b1"))
        except KeyError:
            continue
        c1 = int(m.group("c1"))
        v1 = m.group("v1")
        if m.group("b2"):
            try:
                b2 = book_num(m.group("b2"))
            except KeyError:
                continue
            c2 = int(m.group("c2"))
            v2 = m.group("v2")
        else:
            b2, c2, v2 = b1, c1, v1
        if b1 != b2:
            continue
        if v1 is None:
            rng = _chapter_range(b1, c1, c2)
            if rng:
                out.append(rng)
        else:
            s_v = int(v1)
            e_v = int(v2) if v2 is not None else s_v
            if _valid_cv(b1, c1, s_v) and _valid_cv(b1, c2, e_v):
                out.append((vid(b1, c1, s_v), vid(b1, c2, e_v)))
    return out


def _attr_refs(markup: str) -> tuple[list[tuple[int, int]], str]:
    """Extrai refs de osisRef/passage e troca cada elemento marcado por um marcador."""
    found: list[tuple[int, int]] = []

    def repl(m):
        attrs = dict(_ATTR.findall(m.group("attrs") or ""))
        if "osisRef" in attrs:
            found.extend(_osis(attrs["osisRef"]))
        elif "passage" in attrs:
            found.extend(_scan(attrs["passage"], loose=True))
        else:
            return m.group(0)
        return _PLACEHOLDER

    return found, _ELEM.sub(repl, markup)


def find_refs(text: str) -> list[tuple[int, int]]:
    """Referências encontradas em texto puro ou em marcação TEI/OSIS/ThML.

    Retorna pares (start_vid, end_vid) sem duplicatas, na ordem em que aparecem
    (marcação primeiro, depois prosa).
    """
    if not text:
        return []
    attr_found, rest = _attr_refs(text)
    plain = re.sub(r"<[^>]+>", " ", rest)
    prose = _scan(plain, loose=False)
    seen: set[tuple[int, int]] = set()
    out = []
    for start, end in attr_found + prose:
        pair = (min(start, end), max(start, end))  # "Mt 26:21-15" (erro de fonte) vira 15-21
        if pair not in seen:
            seen.add(pair)
            out.append(pair)
    return out


if __name__ == "__main__":
    refs = find_refs

    assert refs("Phil. 1:1") == [(50001001, 50001001)]
    assert refs("Php 2:5-8") == [(50002005, 50002008)]
    assert refs("Rom 8:28; 12:1, 2") == [(45008028, 45008028), (45012001, 45012001), (45012002, 45012002)]
    assert refs("Matt. 5:3-12") == [(40005003, 40005012)]
    assert refs("2 Cor. 5:17") == [(47005017, 47005017)]
    assert refs("II Kings 3:1") == [(12003001, 12003001)]
    assert refs("Ps 23") == [(19023001, 19023006)], refs("Ps 23")
    assert refs("Joh 10:7,9; 14:6; Ro 5:2") == [
        (43010007, 43010007), (43010009, 43010009), (43014006, 43014006), (45005002, 45005002)]
    assert refs("Eph 2:13; 3:12") == [(49002013, 49002013), (49003012, 49003012)]
    assert refs("Gen 1:1-2:3") == [(1001001, 1002003)]
    assert refs("Rom 8:28, 1 Cor 13:4") == [(45008028, 45008028), (46013004, 46013004)]
    assert refs("Joh 15:4,5,7; 2Co 3:4,5 through. Eph 3:16") == [
        (43015004, 43015004), (43015005, 43015005), (43015007, 43015007),
        (47003004, 47003004), (47003005, 47003005), (49003016, 49003016)]
    assert refs("Ps 23; 1 Cor 13") == [(19023001, 19023006), (46013001, 46013013)]
    assert refs("Mt 26:21-15") == [(40026015, 40026021)]
    assert refs("Phil. 1:1 is an example, not a ref 23") == [(50001001, 50001001)]
    assert refs("Vol 3 of the work") == []
    assert refs("Jude 30") == []  # fora da versificação
    assert refs("Psal 23") == [(19023001, 19023006)]
    assert refs("1 Joh 2:1") == [(62002001, 62002001)]
    assert refs("Lu 4:3") == [(42004003, 42004003)]
    assert refs("Ecclus 3:1") == []  # apócrifo: fora do cânon de 66 livros
    # "Phil." ambíguo: com capítulo:versículo é Filipenses; sem ":" é Filemom (Smith)
    assert refs("Phil. 2:5") == [(50002005, 50002005)]
    assert refs("Phil 4:3") == [(50004003, 50004003)]
    assert refs("Phil. 2:5, 7") == [(50002005, 50002005), (50002007, 50002007)]
    assert refs("Apphia, addressed with Philemon and Archippus in Phil. 2; a member") == [(57001002, 57001002)]
    assert refs("Archippus ... called Phil 2.") == [(57001002, 57001002)]
    assert refs("Phil. 2-3") == [(57001002, 57001003)]
    assert refs("Phil. 2, 4") == [(57001002, 57001002), (57001004, 57001004)]
    assert refs("Phil. 30") == []  # Filemom tem 25 versículos
    assert refs("Phil. 5:3") == []  # sem capítulo 5 em Filipenses; Filemom não tem capítulo 5
    assert refs("Soph. Phil. 534") == []  # Philoctetes, não é livro bíblico
    assert refs("Philm 1:2") == [(57001002, 57001002)]
    assert refs("Philem 1:2") == [(57001002, 57001002)]
    assert refs("Phm 1:2") == [(57001002, 57001002)]
    assert refs("Philemon 1:2") == [(57001002, 57001002)]
    assert refs('<scripRef passage="phm 4:10">Philemon 4:10</scripRef>') == []  # capítulo 4 não existe em Filemom
    assert refs("Philippians 2") == [(50002001, 50002030)]  # nome completo: capítulo inteiro, nunca Filemom
    # marcação OSIS (Easton): "Rev. 1:8" + "11" de outra referência não vira Rev 1:11
    s = ('These letters occur in <ref osisRef="Bible:Rev.1.8">Rev. 1:8</ref>,'
         '<ref osisRef="Bible:Gen.1.11">11</ref>; <ref osisRef="Bible:Gen.21.6">21:6</ref>.')
    assert refs(s) == [(66001008, 66001008), (1001011, 1001011), (1021006, 1021006)], refs(s)
    assert refs('<ref osisRef="Bible:Phil.2.5-Phil.2.8">Phil 2:5-8</ref>') == [(50002005, 50002008)]
    assert refs('<ref osisRef="Bible:Num.12">Num 12</ref>') == [(4012001, 4012016)]
    # ThML (Smith): código 'jud' = Judges
    assert refs('<scripRef passage="jud 7:22">Judges 7:22</scripRef>') == [(7007022, 7007022)]
    assert refs('<scripRef passage="2ki 19:37">2 Kings 19:37</scripRef>') == [(12019037, 12019037)]
    # ThML sem atributo (Torrey): cai na prosa
    assert refs("Ps 65:4<br /><scripRef>Joh 10:7,9</scripRef>") == [
        (19065004, 19065004), (43010007, 43010007), (43010009, 43010009)]
    print("refparse: self-tests ok")
