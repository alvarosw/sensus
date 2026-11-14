"""Divide o comentário de cada Salmo do módulo TDavid (Spurgeon, Treasury of David) em versículos.

O módulo guarda o texto de cada Salmo inteiro no versículo 1. Dentro dele, o comentário é versículo a versículo:
as seções (EXPOSITION, EXPLANATORY NOTES AND QUAINT SAYINGS, HINTS TO THE VILLAGE PREACHER e variantes) trazem
parágrafos que começam com "Verse N." ou "Verses N-M.". Esta função corta o texto nesses marcadores e devolve
(início, fim, texto) por versículo ou intervalo. Antes do primeiro marcador de cada seção (visão geral, "SUBJECT.",
"Whole Psalm.") o texto fica no versículo 1. Parágrafos de um mesmo intervalo, de seções diferentes, são juntados
na ordem do módulo.

Fora do comentário, saem: as listas bibliográficas "WORKS UPON THE … PSALM" (outros autores), "HERE ENDETH …"
(marca de fim de livro) e "BISHOP FISHER'S …" (referência a outra obra). Depois de uma delas, o texto é ignorado
até a próxima seção.

Função pura: nada de I/O. O uso é em sword_commentaries.py, só para o módulo TDavid.
"""

import re

# Cabeçalho de seção. Variam as grafias do módulo ("HINTS TO PREACHERS.", com ou sem ponto final). O texto
# que vem na mesma linha depois do cabeçalho ("HINTS TO THE VILLAGE PREACHER Whole Psalm.") continua no parágrafo.
SECTION_HEAD = re.compile(
    r"^(EXPOSITION|EXPLANATORY NOTES(?: AND QUAINT SAYINGS)?|HINTS TO (?:THE )?(?:VILLAGE )?PREACHERS?|"
    r"NOTES RELATING TO THE PSALM AS A WHOLE)\.?(?=\s|$)")
# Cabeçalho do salmo, "Psalm 23 OVERVIEW", que sai do texto (o número já está no vid).
OVERVIEW_HEAD = re.compile(r"^Psalms? \d+(?: OVERVIEW)?$")
# Fora do comentário: bibliografia sobre o salmo, marca de fim de livro e referência a outra obra.
SKIP_BLOCK = re.compile(r"^(?:WORKS?\s+UPON\s|HERE ENDETH\b|BISHOP FISHER)")
# Marcador de versículo no começo de um parágrafo: "Verse 1.", "Verses 1-3.", "Ver. 2,4-5,8.", "Verse 2 (last clause)".
# O módulo usa "Verse" e também a abreviação "Ver." (salmo 119). O número aceita "l" e "I" no lugar de "1" (OCR).
VERSE_HEAD = re.compile(r"^(?:Verses?|Vers?\.)\s*([\dlI][\dlI ,\-–]*?)(?=\s*[.:;(—–]|\s+[\"“‘A-Za-z]|$)")
VERSE_ITEM = re.compile(r"\s*([\dlI]{1,3})(?:\s*[-–]\s*([\dlI]{1,3}))?\s*")


def _num(token: str) -> int:
    return int(token.replace("l", "1").replace("I", "1"))


def _spans(marker: str) -> list[tuple[int, int]] | None:
    """Intervalos de um marcador: "1-3" -> [(1, 3)]; "5, 9" -> [(5, 5), (9, 9)]; None se não for número."""
    spans = []
    for item in marker.strip(" ,").split(","):
        m = VERSE_ITEM.fullmatch(item)
        if not m:
            return None
        a = _num(m.group(1))
        b = _num(m.group(2)) if m.group(2) else a
        spans.append((a, max(a, b)))
    return spans


def _paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def psalm_segments(text: str) -> list[tuple[int, int, str]]:
    """Parágrafos do comentário de um Salmo com o intervalo de versículos de cada um.

    text: texto do versículo 1 do módulo (já sem marcação), com parágrafos separados por linha em branco.
    Devolve [(v_início, v_fim, parágrafo)] na ordem do módulo, sem os cabeçalhos de seção.
    """
    out: list[tuple[int, int, str]] = []
    current: list[tuple[int, int]] | None = None
    skipping = False

    def handle(p: str) -> None:
        nonlocal current, skipping
        if SKIP_BLOCK.match(p):
            skipping = True
            return
        if skipping:
            return
        m = VERSE_HEAD.match(p)
        spans = _spans(m.group(1)) if m else None
        if spans:
            current = spans
        elif current is None:
            current = [(1, 1)]  # visão geral e texto antes do primeiro marcador: versículo 1
        for a, b in current:
            out.append((a, b, p))

    for p in _paragraphs(text):
        if OVERVIEW_HEAD.match(p):
            continue
        m = SECTION_HEAD.match(p)
        if m:
            current = None  # nova seção: texto sem marcador volta a ser do versículo 1
            skipping = False
            rest = p[m.end():].strip()
            if rest:
                handle(rest)
            continue
        handle(p)
    return out


def psalm_rows(base_vid: int, text: str) -> list[tuple[int, int, str]]:
    """Linhas (start_vid, end_vid, texto) de um Salmo; base_vid é o vid do versículo 1 (ex.: 19023001).

    Parágrafos de mesmo intervalo viram uma linha só, na ordem do módulo.
    """
    chapter = base_vid - (base_vid % 1000)  # 19023000: livro e capítulo, versículo 0
    grouped: dict[tuple[int, int], list[str]] = {}
    for a, b, para in psalm_segments(text):
        grouped.setdefault((a, b), []).append(para)
    rows = []
    for (a, b), paras in grouped.items():
        rows.append((chapter + a, chapter + b, "\n\n".join(paras)))
    rows.sort(key=lambda r: (r[0], r[1]))
    return rows
