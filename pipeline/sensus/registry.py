"""Fontes do registro do núcleo (packages/core/src/domain/sources.ts) vistas pelo pipeline.

O banco completo precisa ter todas as fontes que o app conhece. As versões de dados 2026.10.18.1 e .2 saíram sem
15 fontes porque o banco foi montado num checkout cuja data/staging não tinha essas pastas; nada avisou. Este
módulo dá ao builder a lista do registro para recusar um banco completo incompleto.
"""

import re
from pathlib import Path

from sensus.staging import ROOT

SOURCES_TS = ROOT / "packages" / "core" / "src" / "domain" / "sources.ts"

# Chave de uma entrada do objeto SOURCES: "  blivre: {" ou "  'sword-kd': {".
_ENTRY = re.compile(r"^\s+'?([A-Za-z0-9][A-Za-z0-9_-]*)'?\s*:\s*\{", re.M)


def registered_sources(ts_text: str) -> set[str]:
    """Ids das fontes declaradas em `export const SOURCES ... = { ... };`."""
    start = ts_text.find("export const SOURCES")
    if start < 0:
        raise ValueError("SOURCES não encontrado em sources.ts")
    body_start = ts_text.index("= {", start)
    end = ts_text.index("\n};", body_start)
    return set(_ENTRY.findall(ts_text[body_start:end]))


def missing_sources(staged: set[str], ts_text: str) -> list[str]:
    """Fontes do registro sem staging, em ordem alfabética (vazio = banco completo pode ser montado)."""
    return sorted(registered_sources(ts_text) - staged)


def staged_sources(staging: Path) -> set[str]:
    """Pastas de staging que são fontes (têm source.json)."""
    return {d.name for d in staging.iterdir() if d.is_dir() and (d / "source.json").exists()}
