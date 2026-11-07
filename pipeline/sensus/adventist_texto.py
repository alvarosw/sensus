"""Regras puras do texto das obras adventistas (ingest/adventist_pd.py): números romanos, cabeçalhos de capítulo e de
seção, notas de rodapé e linhas só de referência. Sem dependência de pysword, para o teste rodar com o python3 do
sistema.

Capítulos em sequência: o cabeçalho "CHAPTER ..." traz romano, palavra ("ONE") ou OCR ruim ("UAL"); o número é o
anterior + 1, ou +2 quando o romano lido confirma um capítulo perdido.
"""

import re

from sensus.refs import vid

ROMAN = re.compile(r"^[IVXLC]+$")
# Número romano de capítulo lido errado pelo OCR do scan de 1907 ("IIL" = III, "XVILE" = XVII).
ROMAN_OCR = {"IIL": "III", "XVILE": "XVII"}
ROMAN_VAL = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}

# Cabeçalho de capítulo ("CHAPTER IX", "CHAPTER EIGHTY-SEVEN.", "CHAPTER: Vit"): o grupo 1 é o que vem depois do nome.
CHAPTER_HEAD = r"^CHAPTER\b[\s:.]*(\S{0,30})[\s.:]*$"
# Título de seção com versículos, "(Chapter 11:3-13)" ou "(Chapter 11:1, 2)": capítulo, versículo e fim do intervalo.
SECTION_HEAD = re.compile(
    r"\(\s*Chapter\s+(\d{1,2})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3})|\s*,\s*(\d{1,3}))?\s*\)\s*$")
# "This chapter is based on Luke 2:1-20." (nota editorial do capítulo, com OCR "ba.sed").
BASED_ON = re.compile(r"^This\s+chapter\s+is\s+ba\.?\s?sed\s+on\b.*$")
# Linha que é só uma referência (nota de rodapé de página): "Dan. 9:24-26.", "Zech. 9:16, 17.".
REF_LINE = re.compile(r"^[^A-Za-z]*(?:[1-3]\s?)?[A-Z][A-Za-z]{1,12}\.?\s*\d{1,3}\s?:\s?\d{1,3}.{0,100}$")
# Nota de rodapé dentro do texto, com marca de OCR ("*Phil. 3:21, R. V.", "«Ex. 25:8.", "'Gen. 12:2, 3.").
FOOT_FRAG = re.compile(
    r"(?<![A-Za-z])[*«»^|†‡'][ ]?[a-zi0-9]{0,2}\s?(?:[1-3]\s?)?[A-Z][A-Za-z]{1,12}\.?\s*\d{1,3}\s?:\s?\d{1,3}"
    r"[^.]{0,40}\.(?:\s*[A-Z]\.)*")


def to_roman(n: int) -> str:
    vals = [(100, "C"), (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    out = ""
    for v, sym in vals:
        while n >= v:
            out += sym
            n -= v
    return out


def roman_value(s: str) -> int | None:
    """Valor de um número romano ('XII' -> 12); None se não for romano."""
    if not s or not ROMAN.match(s):
        return None
    total = prev = 0
    for ch in reversed(s):
        v = ROMAN_VAL[ch]
        total = total - v if v < prev else total + v
        prev = max(prev, v)
    return total


def next_chapter(last: str | None, token: str) -> str:
    """Número romano do capítulo de um cabeçalho "CHAPTER ...", em sequência.

    O romano lido (com as correções de ROMAN_OCR) só vale se for o capítulo seguinte ou o seguinte a esse
    (cabeçalho perdido). Palavra ("ONE") e OCR ruim ("UAL", "XL" por "XI") dão o próximo número.
    """
    n = roman_value(last or "") or 0
    tok = token.upper().rstrip(".:")
    tok = ROMAN_OCR.get(tok, tok)
    val = roman_value(tok)
    return to_roman(val if val in (n + 1, n + 2) else n + 1)


def section_span(book: int, m: re.Match) -> tuple[int, int]:
    """(início, fim) em vid de um título "(Chapter c:v1-v2)" ou "(Chapter c:v1, v2)" do livro `book`."""
    c, v1 = int(m.group(1)), int(m.group(2))
    v2 = int(m.group(3) or m.group(4) or v1)
    return vid(book, c, v1), vid(book, c, max(v1, v2))


def tira_notas(para: str) -> tuple[str, list[str]]:
    """Tira do parágrafo as notas de rodapé com marca de OCR. Devolve (texto, trechos das notas).

    Os trechos saem do texto; quem chama acha as referências em cada um (ingest/refparse.find_refs).
    """
    notas: list[str] = []

    def take(m: re.Match) -> str:
        notas.append(m.group(0))
        return " "

    return " ".join(FOOT_FRAG.sub(take, para).split()), notas
