"""Versificação: compara, capítulo a capítulo, a contagem de versículos de uma Bíblia com a KJV.

O app usa a versificação KJV (vid = livro*1_000_000 + capítulo*1000 + versículo). Uma tradução que numera
diferente (Salmos com título como versículo 1, Malaquias 4 dentro de 3, versículos fundidos) é alinhada antes
pela TVTMS (pipeline/bibles/tvtms.py) e só então contada aqui. Critério (ver docs/BIBLES_LICENSES.md): pelo menos
99,5% dos capítulos com a mesma contagem da KJV, versículos numerados (com ou sem texto).

Omissões do texto crítico: 16 versículos da KJV que as traduções modernas (com base no texto crítico) não
numeram. Eles não contam contra o critério, nos dois lados da comparação: nem a KJV nem a Bíblia são obrigadas
a tê-los. Ver OMISSOES_TEXTO_CRITICO.

Funções puras (sem I/O). O carregamento dos arquivos fica em pipeline/package_bibles.py.

Rodar os testes a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.refs import parse_ref  # noqa: E402

LIMIAR_CAPITULOS = 0.995

# Versículos da KJV que o texto crítico (NA28/SBLGNT) não sustenta e que, por isso, faltam ou ficam sem texto em
# traduções modernas: Mt 17:21, 18:11, 23:14; Mc 7:16, 9:44, 9:46, 11:26, 15:28; Lc 17:36, 23:17; Jo 5:4; At 8:37,
# 15:34, 24:7, 28:29; Rm 16:24. Conferido: a BSB (en) omite exatamente esses 16 versículos.
# Atenção: "Jo" é Jó em pt; João é "Jn".
OMISSOES_TEXTO_CRITICO = frozenset(parse_ref(r) for r in (
    "Mt 17:21", "Mt 18:11", "Mt 23:14",
    "Mc 7:16", "Mc 9:44", "Mc 9:46", "Mc 11:26", "Mc 15:28",
    "Lc 17:36", "Lc 23:17",
    "Jn 5:4",
    "At 8:37", "At 15:34", "At 24:7", "At 28:29",
    "Rm 16:24",
))


def chapter_key(vid: int) -> int:
    """Livro*1000 + capítulo: chave do capítulo a partir do vid."""
    return vid // 1000


def chapter_counts(verses: dict[int, str], ignore: frozenset[int] = frozenset()) -> Counter:
    """Número de versículos numerados em cada capítulo, com ou sem texto (exceto os de `ignore`).

    Versículo numerado sem texto (a tradução marca a omissão, ex.: Atos 8:37) conta como numeração presente;
    ele é reportado à parte em compare(), porque é lacuna de texto, não de versificação.
    """
    counts: Counter = Counter()
    for vid in verses:
        if vid not in ignore:
            counts[chapter_key(vid)] += 1
    return counts


def compare(verses: dict[int, str], kjv_verses: dict[int, str],
            ignore: frozenset[int] = OMISSOES_TEXTO_CRITICO) -> dict:
    """Compara a Bíblia com a KJV. Retorna capítulos avaliados, os que batem e os que não batem.

    `ignore` (padrão: omissões do texto crítico) sai dos dois lados. Cada item de `bad` é
    (livro, capítulo, contagem KJV, contagem da Bíblia, versículos vazios no capítulo). `empty` lista os vids
    numerados sem texto. Capítulo que existe só numa das duas conta como diferença.
    """
    kjv = chapter_counts(kjv_verses, ignore)
    bib = chapter_counts(verses, ignore)
    empty_by_chapter: Counter = Counter(
        chapter_key(v) for v, t in verses.items() if v not in ignore and not t.strip())
    keys = sorted(set(kjv) | set(bib))
    bad = []
    for k in keys:
        if kjv.get(k, 0) != bib.get(k, 0):
            bad.append((k // 1000, k % 1000, kjv.get(k, 0), bib.get(k, 0), empty_by_chapter.get(k, 0)))
    total = len(kjv)
    match = total - sum(1 for k in kjv if kjv[k] != bib.get(k, 0))
    empty = sorted(v for v, t in verses.items() if v not in ignore and not t.strip())
    return {"chapters": total, "match": match, "bad": bad, "empty": empty}


def passes(report: dict, limiar: float = LIMIAR_CAPITULOS) -> bool:
    """True quando a fração de capítulos iguais à KJV chega ao limiar."""
    if report["chapters"] == 0:
        return False
    return report["match"] / report["chapters"] >= limiar
