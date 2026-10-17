"""Números Strong: forma, base (sem sufixo) e normalização. Regra única do pipeline.

Forma: prefixo 'G' (grego) ou 'H' (hebraico/aramaico), 1 a 5 dígitos e sufixo opcional de letras de
desambiguação STEPBible, mantido como na fonte (ex.: 'G2424', 'H0935P', 'H2148v', 'G20001').

strong_base = prefixo + número com zeros à esquerda até 4 dígitos, sem sufixo:
  'H0935P' -> 'H0935'; 'G2424G' -> 'G2424'; 'G430' -> 'G0430' (normalização de zeros); 'G20001' -> 'G20001'
  (os 5 dígitos existem no TBESG e ficam inteiros, para não colidir com 'G2000').

O núcleo TypeScript deve ter a mesma regra em parseStrong (packages/core/src/domain/strong.ts, passo 1 de
docs/ARCHITECTURE_REVIEW.md). Os casos de teste estão em pipeline/tests/test_strong.py e devem ser
espelhados lá.
"""

import re

_STRONG = re.compile(r"([GH])(\d{1,5})([A-Za-z]*)")


def parse_strong(strong: str) -> tuple[str, int, str] | None:
    """'H0935P' -> ('H', 935, 'P'). None se não for um Strong."""
    m = _STRONG.fullmatch(strong)
    if m is None:
        return None
    return m.group(1), int(m.group(2)), m.group(3)


def strong_base(strong: str) -> str:
    """Base do Strong: prefixo e número (4 dígitos, com zeros à esquerda), sem sufixo."""
    parts = parse_strong(strong)
    if parts is None:
        raise ValueError(f"Strong inválido: {strong!r}")
    prefix, number, _ = parts
    return f"{prefix}{number:04d}"
