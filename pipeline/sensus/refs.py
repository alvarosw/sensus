"""Livros, ids de versículo (vid) e resolução de abreviações de livros."""

import re
import unicodedata

# (num, osis, name_pt, name_en, testament, chapters, aliases extras)
BOOKS = [
    (1, "Gen", "Gênesis", "Genesis", "OT", 50, "GEN Gn Ge"),
    (2, "Exod", "Êxodo", "Exodus", "OT", 40, "EXO Exo Ex"),
    (3, "Lev", "Levítico", "Leviticus", "OT", 27, "LEV Lv Le"),
    (4, "Num", "Números", "Numbers", "OT", 36, "NUM Nm Nu"),
    (5, "Deut", "Deuteronômio", "Deuteronomy", "OT", 34, "DEU Dt De"),
    (6, "Josh", "Josué", "Joshua", "OT", 24, "JOS Js"),
    (7, "Judg", "Juízes", "Judges", "OT", 21, "JDG Jdg Jz Jg"),
    (8, "Ruth", "Rute", "Ruth", "OT", 4, "RUT Rt Ru"),
    (9, "1Sam", "1 Samuel", "1 Samuel", "OT", 31, "1SA 1Sm 1S"),
    (10, "2Sam", "2 Samuel", "2 Samuel", "OT", 24, "2SA 2Sm 2S"),
    (11, "1Kgs", "1 Reis", "1 Kings", "OT", 22, "1KI 1Rs 1Ki 1Kg"),
    (12, "2Kgs", "2 Reis", "2 Kings", "OT", 25, "2KI 2Rs 2Ki 2Kg"),
    (13, "1Chr", "1 Crônicas", "1 Chronicles", "OT", 29, "1CH 1Cr 1Ch"),
    (14, "2Chr", "2 Crônicas", "2 Chronicles", "OT", 36, "2CH 2Cr 2Ch"),
    (15, "Ezra", "Esdras", "Ezra", "OT", 10, "EZR Ed Ezr"),
    (16, "Neh", "Neemias", "Nehemiah", "OT", 13, "NEH Ne"),
    (17, "Esth", "Ester", "Esther", "OT", 10, "EST Et Es"),
    (18, "Job", "Jó", "Job", "OT", 42, "JOB Jb"),
    (19, "Ps", "Salmos", "Psalms", "OT", 150, "PSA Sl Psalm Pss"),
    (20, "Prov", "Provérbios", "Proverbs", "OT", 31, "PRO Pv Pr Prv"),
    (21, "Eccl", "Eclesiastes", "Ecclesiastes", "OT", 12, "ECC Ec Ecc Qoh"),
    (22, "Song", "Cantares", "Song of Solomon", "OT", 8, "SNG Ct Sng Sol SoS Cant CantaresdeSalomao SongofSongs"),
    (23, "Isa", "Isaías", "Isaiah", "OT", 66, "ISA Is"),
    (24, "Jer", "Jeremias", "Jeremiah", "OT", 52, "JER Jr"),
    (25, "Lam", "Lamentações", "Lamentations", "OT", 5, "LAM Lm La"),
    (26, "Ezek", "Ezequiel", "Ezekiel", "OT", 48, "EZK Ez Eze Ezk"),
    (27, "Dan", "Daniel", "Daniel", "OT", 12, "DAN Dn Da"),
    (28, "Hos", "Oseias", "Hosea", "OT", 14, "HOS Os Ho Oséias"),
    (29, "Joel", "Joel", "Joel", "OT", 3, "JOL Jl Jol Joe"),
    (30, "Amos", "Amós", "Amos", "OT", 9, "AMO Am"),
    (31, "Obad", "Obadias", "Obadiah", "OT", 1, "OBA Ob Obd Abdias"),
    (32, "Jonah", "Jonas", "Jonah", "OT", 4, "JON Jnh"),
    (33, "Mic", "Miqueias", "Micah", "OT", 7, "MIC Mq Mi Miquéias"),
    (34, "Nah", "Naum", "Nahum", "OT", 3, "NAM Na Nam"),
    (35, "Hab", "Habacuque", "Habakkuk", "OT", 3, "HAB Hc"),
    (36, "Zeph", "Sofonias", "Zephaniah", "OT", 3, "ZEP Sf Zep"),
    (37, "Hag", "Ageu", "Haggai", "OT", 2, "HAG Ag"),
    (38, "Zech", "Zacarias", "Zechariah", "OT", 14, "ZEC Zc Zec"),
    (39, "Mal", "Malaquias", "Malachi", "OT", 4, "MAL Ml"),
    (40, "Matt", "Mateus", "Matthew", "NT", 28, "MAT Mt"),
    (41, "Mark", "Marcos", "Mark", "NT", 16, "MRK Mc Mk Mrk Mar"),
    (42, "Luke", "Lucas", "Luke", "NT", 24, "LUK Lc Lk Luk"),
    (43, "John", "João", "John", "NT", 21, "JHN Jhn Joh Jn"),
    (44, "Acts", "Atos", "Acts", "NT", 28, "ACT At Ac Act"),
    (45, "Rom", "Romanos", "Romans", "NT", 16, "ROM Rm Ro"),
    (46, "1Cor", "1 Coríntios", "1 Corinthians", "NT", 16, "1CO 1Co"),
    (47, "2Cor", "2 Coríntios", "2 Corinthians", "NT", 13, "2CO 2Co"),
    (48, "Gal", "Gálatas", "Galatians", "NT", 6, "GAL Gl Ga"),
    (49, "Eph", "Efésios", "Ephesians", "NT", 6, "EPH Ef"),
    (50, "Phil", "Filipenses", "Philippians", "NT", 4, "PHP Fp Php Phl Flp"),
    (51, "Col", "Colossenses", "Colossians", "NT", 4, "COL Cl"),
    (52, "1Thess", "1 Tessalonicenses", "1 Thessalonians", "NT", 5, "1TH 1Ts 1Th"),
    (53, "2Thess", "2 Tessalonicenses", "2 Thessalonians", "NT", 3, "2TH 2Ts 2Th"),
    (54, "1Tim", "1 Timóteo", "1 Timothy", "NT", 6, "1TI 1Tm 1Ti"),
    (55, "2Tim", "2 Timóteo", "2 Timothy", "NT", 4, "2TI 2Tm 2Ti"),
    (56, "Titus", "Tito", "Titus", "NT", 3, "TIT Tt Tit"),
    (57, "Phlm", "Filemom", "Philemon", "NT", 1, "PHM Fm Phm Flm"),
    (58, "Heb", "Hebreus", "Hebrews", "NT", 13, "HEB Hb"),
    (59, "Jas", "Tiago", "James", "NT", 5, "JAS Tg Jm"),
    (60, "1Pet", "1 Pedro", "1 Peter", "NT", 5, "1PE 1Pe 1Pd"),
    (61, "2Pet", "2 Pedro", "2 Peter", "NT", 3, "2PE 2Pe 2Pd"),
    (62, "1John", "1 João", "1 John", "NT", 5, "1JN 1Jo 1Jn"),
    (63, "2John", "2 João", "2 John", "NT", 1, "2JN 2Jo 2Jn"),
    (64, "3John", "3 João", "3 John", "NT", 1, "3JN 3Jo 3Jn"),
    (65, "Jude", "Judas", "Jude", "NT", 1, "JUD Jd Jud"),
    (66, "Rev", "Apocalipse", "Revelation", "NT", 22, "REV Ap Re Rv Revelationofjohn"),
]

BOOK_BY_NUM = {b[0]: b for b in BOOKS}
BOOK_BY_OSIS = {b[1]: b for b in BOOKS}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = re.sub(r"^(iii|ii|i)\s+", lambda m: str(len(m.group(1))), s)
    s = re.sub(r"^(first|second|third)\s+", lambda m: {"first": "1", "second": "2", "third": "3"}[m.group(1)], s)
    return re.sub(r"[^a-z0-9]", "", s)


_ALIASES: dict[str, int] = {}
for _b in BOOKS:
    for _a in [_b[1], _b[2], _b[3], *_b[6].split()]:
        _k = _norm(_a)
        if _ALIASES.get(_k, _b[0]) != _b[0]:
            raise AssertionError(f"alias ambíguo: {_a!r}")
        _ALIASES[_k] = _b[0]


def book_num(alias: str) -> int:
    """Resolve OSIS, USFM, abreviações comuns e nomes pt/en para o número do livro."""
    n = _ALIASES.get(_norm(alias))
    if n is None:
        raise KeyError(f"livro desconhecido: {alias!r}")
    return n


def vid(book: int | str, chapter: int, verse: int) -> int:
    b = book if isinstance(book, int) else book_num(book)
    return b * 1_000_000 + int(chapter) * 1000 + int(verse)


def split_vid(v: int) -> tuple[int, int, int]:
    return v // 1_000_000, (v // 1000) % 1000, v % 1000


def osis_ref(v: int) -> str:
    b, c, vs = split_vid(v)
    return f"{BOOK_BY_NUM[b][1]}.{c}.{vs}"


_REF_RE = re.compile(r"^\s*(.+?)[\s.]*(\d+)[.:](\d+)\s*$")


def parse_ref(ref: str) -> int:
    """'Phil.1.1', 'Php 1:1', 'Filipenses 1:1' -> vid."""
    m = _REF_RE.match(ref)
    if not m:
        raise ValueError(f"referência inválida: {ref!r}")
    return vid(m.group(1), int(m.group(2)), int(m.group(3)))
