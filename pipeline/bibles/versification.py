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

import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.refs import parse_ref, split_vid  # noqa: E402

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


def _pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 3:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0:
        return 0.0
    return sxy / (sxx * syy) ** 0.5


def text_check(texts: dict[int, str], kjv: dict[int, str], book: int = 19, min_verses: int = 6) -> list[dict]:
    """Checagem de TEXTO por salmo, independente da língua: o comprimento (letras) de cada versículo alinhado
    deve acompanhar o comprimento do mesmo versículo da KJV.

    Para cada capítulo, correlaciona o comprimento do texto alinhado no v.k com o da KJV no v.k+d, para d em
    (-1, 0, 1). Se outro deslocamento explica melhor o texto, o capítulo é acusado de deslocado. Também acusa
    o primeiro e o último versículo cujo comprimento sai da faixa de 1/4 a 4 vezes o esperado pela razão do
    capítulo. Devolve a lista de achados (vazia = nada a apontar).
    """
    from collections import defaultdict

    def letters(t: str) -> int:
        return len(re.findall(r"\w", t))

    by_ch: dict[int, list[int]] = defaultdict(list)
    for v in kjv:
        if v // 1_000_000 == book:
            by_ch[v // 1000].append(v)
    findings = []
    for ck, kv in sorted(by_ch.items()):
        kv.sort()
        if len(kv) < min_verses:
            continue
        # Título do salmo (antes da linha em branco, na KJV) não é versículo: não entra no comprimento.
        k = [letters(kjv[v].partition("\n\n")[2] if i == 0 else kjv[v]) for i, v in enumerate(kv)]
        b = [letters(texts.get(v, "")) for v in kv]
        corr = {}
        for d in (-1, 0, 1):
            # Pares só onde os dois têm texto: versículo sem texto (fundido ou ausente) não diz nada sobre o deslocamento.
            pairs = [(b[i + d], k[i]) for i in range(len(kv))
                     if 0 <= i + d < len(kv) and b[i + d] and k[i]]
            corr[d] = _pearson([p[0] for p in pairs], [p[1] for p in pairs])
        best = max(corr, key=lambda d: corr[d])
        ck_ratio = (sum(b) or 1) / (sum(k) or 1)
        motivo = []
        if best != 0 and corr[best] - corr[0] > 0.2:
            motivo.append(f"texto combina melhor com a KJV deslocado em {best:+d} versículo(s)")
        if corr[0] < 0.3:
            motivo.append("correlação de comprimento baixa")
        for pos, idx in (("primeiro", 0), ("último", len(kv) - 1)):
            esperado = ck_ratio * k[idx]
            if k[idx] and esperado and not (0.5 <= b[idx] / esperado <= 2):
                motivo.append(f"{pos} versículo com comprimento fora da faixa")
        if motivo:
            bk, c, _ = split_vid(ck * 1000 + 1)
            findings.append({"book": bk, "chapter": c, "corr": {d: round(x, 2) for d, x in corr.items()},
                             "motivos": motivo})
    return findings


def title_check(heads: dict[int, str], kjv: dict[int, str], book: int = 19) -> list[dict]:
    """Checagem de TÍTULO por salmo: a KJV marca o título com linha em branco antes do v.1 ("título\\n\\nverso").
    Todo salmo com título na KJV deve ter cabeçalho no v.1 correspondente, e salmo sem título na KJV não deve ter.
    Acusa os dois casos: título que não aparece (ex.: título que virou texto do v.1) e cabeçalho sobrando."""
    findings = []
    for v in sorted(kjv):
        if v // 1_000_000 != book or v % 1000 != 1:
            continue
        com_titulo = "\n\n" in kjv[v]
        tem_cabecalho = bool(heads.get(v, "").strip())
        if com_titulo and not tem_cabecalho:
            findings.append({"book": book, "chapter": v // 1000 % 1000, "motivo": "KJV tem título e a Bíblia não tem cabeçalho no v.1"})
        elif tem_cabecalho and not com_titulo:
            findings.append({"book": book, "chapter": v // 1000 % 1000, "motivo": "Bíblia tem cabeçalho e a KJV não tem título"})
    return findings
