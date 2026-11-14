"""Abreviaturas dos 66 livros por idioma (ordem canônica), lidas de packages/core/src/domain/book-names.ts.

O arquivo do núcleo é a fonte única: o pipeline lê por regex, como registry.py lê sources.ts. Idioma sem tabela usa
inglês, como refs.ts. Função pura de leitura: não cria nem grava nada.
"""

import re

from sensus.staging import ROOT

BOOK_NAMES_TS = ROOT / "packages" / "core" / "src" / "domain" / "book-names.ts"

# Um bloco por idioma: '  pt: [' ... '  ],'. Dentro, uma linha por livro com 'abbr: '...''.
_BLOCO = re.compile(r"^  (\w+): \[\n(.*?)^  \]", re.S | re.M)
_ABBR = re.compile(r"abbr: '([^']*)'")


def abreviaturas(lang: str, ts_text: str | None = None) -> list[str]:
    """Abreviaturas de `lang` (66, índice = número canônico do livro - 1). ts_text: conteúdo do arquivo (testes)."""
    texto = ts_text if ts_text is not None else BOOK_NAMES_TS.read_text(encoding="utf-8")
    tabelas = {idioma: _ABBR.findall(corpo) for idioma, corpo in _BLOCO.findall(texto)}
    lista = tabelas.get(lang) or tabelas.get("en")
    if not lista:
        raise ValueError("book-names.ts sem tabela de inglês para o fallback")
    if len(lista) != 66:
        raise ValueError(f"book-names.ts: {lang} tem {len(lista)} abreviaturas (esperado 66)")
    return list(lista)
