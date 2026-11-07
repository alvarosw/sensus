"""Versificação: compara, capítulo a capítulo, a contagem de versículos de uma Bíblia com a KJV.

O app usa a versificação KJV (vid = livro*1_000_000 + capítulo*1000 + versículo). Uma tradução que numera
diferente (Salmos com título como versículo 1, Malaquias 4 dentro de 3, versículos fundidos) não entra no
pacote sem mapeamento aprovado. Critério (ver docs/BIBLES_LICENSES.md): pelo menos 99,5% dos capítulos com a
mesma contagem da KJV (versículos numerados, com ou sem texto).

Funções puras (sem I/O). O carregamento dos arquivos fica em pipeline/package_bibles.py.

Rodar os testes a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

from collections import Counter

LIMIAR_CAPITULOS = 0.995


def chapter_key(vid: int) -> int:
    """Livro*1000 + capítulo: chave do capítulo a partir do vid."""
    return vid // 1000


def chapter_counts(verses: dict[int, str]) -> Counter:
    """Número de versículos numerados em cada capítulo, com ou sem texto.

    Versículo numerado sem texto (a tradução marca a omissão, ex.: Atos 8:37) conta como numeração presente;
    ele é reportado à parte em compare(), porque é lacuna de texto, não de versificação.
    """
    counts: Counter = Counter()
    for vid in verses:
        counts[chapter_key(vid)] += 1
    return counts


def compare(verses: dict[int, str], kjv_verses: dict[int, str]) -> dict:
    """Compara a Bíblia com a KJV. Retorna capítulos avaliados, os que batem e os que não batem.

    Cada item de `bad` é (livro, capítulo, contagem KJV, contagem da Bíblia, versículos vazios no capítulo).
    `empty` lista os vids numerados sem texto.
    Capítulo que existe só numa das duas conta como diferença.
    """
    kjv = chapter_counts(kjv_verses)
    bib = chapter_counts(verses)
    empty_by_chapter: Counter = Counter(chapter_key(v) for v, t in verses.items() if not t.strip())
    keys = sorted(set(kjv) | set(bib))
    bad = []
    for k in keys:
        if kjv.get(k, 0) != bib.get(k, 0):
            bad.append((k // 1000, k % 1000, kjv.get(k, 0), bib.get(k, 0), empty_by_chapter.get(k, 0)))
    total = len(kjv)
    match = total - sum(1 for k in kjv if kjv[k] != bib.get(k, 0))
    empty = sorted(v for v, t in verses.items() if not t.strip())
    return {"chapters": total, "match": match, "bad": bad, "empty": empty}


def passes(report: dict, limiar: float = LIMIAR_CAPITULOS) -> bool:
    """True quando a fração de capítulos iguais à KJV chega ao limiar."""
    if report["chapters"] == 0:
        return False
    return report["match"] / report["chapters"] >= limiar
