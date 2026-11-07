"""Alinhamento de versificação pela TVTMS para a KJV (Translators Versification Traditions with Methodology for
Standardisation, STEPBible.org, CC BY 4.0; dados baseados no trabalho do Tyndale House, Cambridge).

Fonte: data/raw/bibles/tvtms/tvtms.txt (baixado de github.com/STEPBible/STEPBible-Data, pasta Versification). Só a
seção "2) EXPANDED VERSION" é lida: uma linha por versículo de cada tradição (Inglês/KJV, Hebraica, Latina,
Grega/LXX, Sinodal etc.), com o alvo na KJV (StandardRef), a ação (Action) e os testes (Tests).

Como funciona, para uma Bíblia carregada no staging:
- Cada versículo da Bíblia (SourceRef) tem uma ou mais linhas. A primeira cujos testes são todos verdadeiros
  nesta Bíblia vale (a própria TVTMS manda seguir para a linha seguinte quando um teste é falso). Sem linha
  aplicável, o versículo fica onde está.
- Testes: REF=Exist (há texto), REF=NotExist, REF=Last (último versículo numerado do capítulo), comparações de
  palavras (<, >, *N, +). Subversículos (".2", "!a") não existem nas Bíblias do staging: Exist é falso e NotExist,
  verdadeiro. Book.C:TextBeforeV1 (título antes do v.1) é tratado como ausente: os títulos não entram nos testes
  (ver BibleView). Os títulos vão para o cabeçalho do v.1 da KJV pela ação de título.
- Ações de título (Psalm title, Renumber title) viram text_division kind 'heading' no v.1 da KJV, nunca texto
  perdido. As demais levam o texto ao primeiro versículo de destino; os outros destinos de um intervalo
  (Concatenation, MergedPrev etc.) ficam numerados sem texto, como "Absent" da TVTMS. Essa escolha mantém a
  numeração certa; a posição exata do texto fundido não é reconstruída (sem subversículos).
- Livros fora do cânon protestante (Tobias, Sabedoria, Esg, Ade...) não entram: as linhas que os citam são
  ignoradas. Referências com letra no capítulo (Est.C, Esg.A...) são tratadas como inexistentes.

Funções puras (sem I/O). O carregamento do arquivo fica em load_rules_file().
Rodar os testes a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import NamedTuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.refs import book_num, vid  # noqa: E402
from sensus.staging import RAW  # noqa: E402

TVTMS_FILE = RAW / "bibles" / "tvtms" / "tvtms.txt"

_SRC_RE = re.compile(r"^([0-9A-Za-z]+)\.(\d+|[A-Za-z]+):(\d+|Title)(?:[!.]([0-9a-z]+))?$")
_TGT_CHAP_RE = re.compile(r"^(?:([0-9A-Za-z]+)\.)?(\d+):(.+)$")
_CROSS_RE = re.compile(r"^(\d+)-(\d+):(\d+)$")       # 25-3:1 (intervalo entre capítulos)
_RANGE_RE = re.compile(r"^(\d+)-(\d+)$")              # 1-3 (intervalo no mesmo capítulo)
_NUM_RE = re.compile(r"^(\d+)[a-z]?$")                # 1 ou 1b (letra de subdivisão ignorada)
_REF_RE = re.compile(r"^([0-9A-Za-z]+)\.(\d+|[A-Za-z]+):(TextBeforeV1|\d+)(?:\.(\d+))?$")
_WORD_RE = re.compile(r"[぀-ヿ㐀-䶿一-鿿가-힯]|[^\W_]+")


class Ref(NamedTuple):
    book: int | None        # None: livro fora do cânon protestante
    chapter: int | None     # None: capítulo com letra (Est.C) ou fora do cânon
    verse: int | str        # número, ou 'before' (TextBeforeV1)
    sub: int | None         # subversículo (.2) ou None


class Rule(NamedTuple):
    tradition: str
    source: int             # vid do versículo da Bíblia
    targets: tuple          # ((vid, é_título), ...) na KJV
    action: str
    tests: tuple            # cláusulas já analisadas (ver parse_clause)
    line: int               # número da linha no arquivo (para relatório)


def units(text: str) -> int:
    """Número de palavras (cada ideograma conta como uma), para os testes de comparação."""
    return len(_WORD_RE.findall(text))


# ---- leitura -----------------------------------------------------------------

def parse_src(s: str) -> Ref | None:
    """SourceRef de uma linha. Subversículos e títulos ficam fora (None e 'Title' não entram na indexação)."""
    m = _SRC_RE.match(s.strip())
    if not m:
        return None
    book, ch, v, sub = m.groups()
    return _ref(book, ch, v, sub)


def _ref(book: str, ch: str, v: str, sub: str | None) -> Ref:
    try:
        b = book_num(book)
    except KeyError:
        b = None
    chapter = int(ch) if ch.isdigit() else None
    verse: int | str
    if v == "Title":
        verse = "Title"
    elif v.startswith("TextBefore"):
        verse = "before"
    else:
        verse = int(v)
    subv = int(sub) if sub and sub.isdigit() else (None if not sub else -1)
    return Ref(b, chapter, verse, subv)


def parse_targets(s: str) -> tuple:
    """StandardRef -> ((vid, é_título), ...). Ex.: 'Gen.5:32; 6:1' -> 5:32 e 6:1; 'Psa.3:Title' -> (3,1,título)."""
    out: list[tuple[int, bool]] = []
    book, chap = None, None
    for part in re.split(r";", s):
        part = re.sub(r"!\w+", "", part).strip()
        if not part:
            continue
        m = _TGT_CHAP_RE.match(part)
        if m:
            if m.group(1):
                book = m.group(1)
            chap = int(m.group(2))
            rest = m.group(3)
        elif chap is not None:
            rest = part                      # continuação: '6:1' já tem capítulo; senão, só versículos
            m2 = _TGT_CHAP_RE.match(rest)
            if m2:
                chap = int(m2.group(2))
                rest = m2.group(3)
        else:
            continue
        if book is None:
            continue
        try:
            b = book_num(book)
        except KeyError:
            continue
        for piece in rest.split(","):
            piece = piece.strip()
            if piece == "Title":
                out.append((vid(b, chap, 1), True))
            elif m3 := _CROSS_RE.match(piece):
                c1, c2, v2 = int(m3.group(1)), int(m3.group(2)), int(m3.group(3))
                out.append((vid(b, chap, c1), False))
                out.append((vid(b, c2, v2), False))
                chap = c2
            elif m4 := _RANGE_RE.match(piece):
                a, z = int(m4.group(1)), int(m4.group(2))
                out.extend((vid(b, chap, n), False) for n in range(a, z + 1))
            elif m5 := _NUM_RE.match(piece):
                out.append((vid(b, chap, int(m5.group(1))), False))
    seen, uniq = set(), []
    for t in out:
        if t[0] not in seen:
            seen.add(t[0])
            uniq.append(t)
    return tuple(uniq)


def parse_ref_in_test(s: str) -> Ref | None:
    m = _REF_RE.match(s.strip())
    if not m:
        return None
    book, ch, v, sub = m.groups()
    return _ref(book, ch, v if v != "TextBeforeV1" else "TextBeforeV1", sub)


_CLAUSE_EQ = re.compile(r"^(.+?)=(Exist|NotExist|Last)$")
_CLAUSE_CMP = re.compile(r"^(.+?)([<>])(.+)$")


def _term(s: str):
    m = re.match(r"^(.+?)(?:\*(\d+))?$", s.strip())
    if not m:
        return None
    r = parse_ref_in_test(m.group(1))
    return None if r is None else (r, int(m.group(2) or 1))


def parse_clause(s: str):
    """Cláusula de teste -> ('eq', Ref, 'Exist'|'NotExist'|'Last') ou ('cmp', op, [(Ref, mult)], [(Ref, mult)])."""
    s = s.strip()
    if m := _CLAUSE_EQ.match(s):
        r = parse_ref_in_test(m.group(1))
        return ("eq", r, m.group(2)) if r is not None else ("false",)
    if m := _CLAUSE_CMP.match(s):
        left = [_term(t) for t in m.group(1).split("+")]
        right = [_term(t) for t in m.group(3).split("+")]
        if None in left or None in right:
            return ("false",)
        return ("cmp", m.group(2), left, right)
    return ("false",)  # teste que não entendemos: não aplica a linha (a TVTMS manda seguir)


def load_rules(text: str) -> tuple[list[Rule], Counter]:
    """Lê a seção Expanded do arquivo da TVTMS. Devolve as regras (na ordem do arquivo) e contagens de descarte."""
    lines = text.splitlines()
    try:
        start = next(i for i, ln in enumerate(lines) if ln.startswith("#DataStart(Expanded)"))
        end = next(i for i, ln in enumerate(lines) if ln.startswith("#DataEnd(Expanded)"))
    except StopIteration:
        raise ValueError("seção #DataStart(Expanded) não encontrada no arquivo da TVTMS")
    rules: list[Rule] = []
    dropped: Counter = Counter()
    for i in range(start + 1, end):
        cols = lines[i].split("\t")
        if len(cols) < 4 or cols[0] in ("", "SourceType") or cols[0].startswith("'"):
            continue
        tradition, src, std, action = (c.strip() for c in cols[:4])
        tests_col = cols[8].strip() if len(cols) > 8 else ""
        if not action:
            dropped["sem ação"] += 1
            continue
        ref = parse_src(src)
        if ref is None or ref.verse == "Title" or ref.verse == "before" or ref.sub is not None:
            dropped["origem fora do formato ou subversículo"] += 1
            continue
        if ref.book is None or ref.chapter is None:
            dropped["origem fora do cânon"] += 1
            continue
        targets = parse_targets(std)
        if not targets:
            dropped["destino vazio ou fora do cânon"] += 1
            continue
        tests = tuple(parse_clause(c) for c in tests_col.split("&") if c.strip())
        rules.append(Rule(tradition, vid(ref.book, ref.chapter, ref.verse), targets, action, tests, i + 1))
    return rules, dropped


def load_rules_file(path: Path = TVTMS_FILE) -> tuple[list[Rule], Counter]:
    with open(path, encoding="utf-8-sig") as f:
        return load_rules(f.read())


# ---- avaliação dos testes na Bíblia ---------------------------------------

class BibleView:
    """Visão da Bíblia para os testes: texto por vid (numerados, mesmo vazios) e último versículo.

    Títulos (text_division 'heading') não entram nos testes: TextBeforeV1 é sempre falso. Motivo: os títulos de
    salmo de cada tradução vêm com rótulos diferentes (Sinodal: "Псалом.", "Песнь восхождения."), e a decisão
    de tradição fica com os testes de contagem (Last) e de texto no v.1, que bastam. Medido: com títulos nos
    testes, a Sinodal ficava 3 capítulos abaixo do critério.
    """

    def __init__(self, verses: dict[int, str]):
        self.verses = verses
        self.last: dict[int, int] = {}
        for v in verses:
            ck = v // 1000
            n = v % 1000
            if n > self.last.get(ck, 0):
                self.last[ck] = n

    def _vid(self, r: Ref) -> int | None:
        if r.book is None or r.chapter is None:
            return None
        if r.verse == "before":
            return vid(r.book, r.chapter, 1)
        return vid(r.book, r.chapter, r.verse)

    def exists(self, r: Ref) -> bool:
        if r.book is None or r.chapter is None:
            return False
        if r.verse == "before":
            return False
        if r.sub not in (None, 0):
            return False
        return bool(self.verses.get(vid(r.book, r.chapter, r.verse), "").strip())

    def words(self, r: Ref) -> int:
        if r.verse == "before" or not self.exists(r):
            return 0
        return units(self.verses[vid(r.book, r.chapter, r.verse)])

    def is_last(self, r: Ref) -> bool:
        if r.book is None or r.chapter is None or r.verse == "before":
            return False
        ck = r.book * 1000 + r.chapter
        return self.last.get(ck, 0) == r.verse and vid(r.book, r.chapter, r.verse) in self.verses

    def holds(self, clause) -> bool:
        kind = clause[0]
        if kind == "false":
            return False
        if kind == "eq":
            _, r, what = clause
            if what == "Exist":
                return self.exists(r)
            if what == "NotExist":
                return not self.exists(r)
            return self.is_last(r)
        _, op, left, right = clause
        lv = sum(self.words(r) * m for r, m in left)
        rv = sum(self.words(r) * m for r, m in right)
        return lv < rv if op == "<" else lv > rv


# ---- reversificação -------------------------------------------------------

def is_title_action(action: str) -> bool:
    return action.lower().endswith("title")


def index_rules(rules: list[Rule]) -> dict[int, list[Rule]]:
    idx: dict[int, list[Rule]] = defaultdict(list)
    for r in rules:
        idx[r.source].append(r)
    return idx


class Result(NamedTuple):
    numbered: dict[int, str]     # vid KJV numerado -> texto ('' = numerado sem texto)
    heads: dict[int, str]        # vid KJV -> título (text_division 'heading')
    target: dict[int, int]       # vid da Bíblia -> vid KJV do primeiro destino (para divisões)
    applied: Counter             # ações aplicadas (identidade incluída)
    dropped: list                # vids da Bíblia sem destino no cânon
    choice: dict                 # vid da Bíblia -> (destinos, ação), como foi escolhido


def reversify(verses: dict[int, str], heads: dict[int, str], index: dict[int, list[Rule]],
              canon: frozenset[int] | None = None, overrides: dict | None = None) -> Result:
    """Aplica a TVTMS: devolve a numeração e os textos na versificação KJV.

    `verses`: vid da Bíblia -> texto (incluindo versículos numerados sem texto).
    `heads`: vid da Bíblia -> título (text_division 'heading').
    `canon`: vids da KJV. Depois de alinhar, o que cai fora dela (ex.: acréscimos gregos de Ester numerados como
    capítulos 11-16) sai da numeração e dos títulos; antes do alinhamento tudo entra, porque a LXX precisa dos
    versículos "extras" para mapear (Sl 9:22 -> 10:1).
    `overrides`: vid da Bíblia -> (destinos, ação), escolhidos antes da regra da TVTMS (ver title_as_verse).
    """
    view = BibleView(verses)
    choice: dict = {}
    numbered: dict[int, str] = {}
    out_heads: dict[int, str] = {}
    target: dict[int, int] = {}
    applied: Counter = Counter()
    dropped: list[int] = []

    def merge(d: dict[int, str], key: int, text: str, sep: str) -> None:
        if not text.strip():
            return
        d[key] = f"{d[key]}{sep}{text}" if d.get(key) else text

    for b in sorted(verses):
        if overrides and b in overrides:
            targets, action = overrides[b]
        else:
            chosen = None
            for rule in index.get(b, ()):
                if all(view.holds(c) for c in rule.tests):
                    chosen = rule
                    break
            if chosen is None:
                targets, action = ((b, False),), "identidade"
            else:
                targets, action = chosen.targets, chosen.action
        choice[b] = (targets, action)
        text = verses[b]
        applied[action] += 1
        if not targets:
            dropped.append(b)
            continue
        # Destino de título: o texto vira cabeçalho do v.1 da KJV, sem número de versículo.
        if is_title_action(action) or all(t for _, t in targets):
            tv = targets[0][0]
            ck = tv // 1000
            head_vid = ck * 1000 + 1
            merge(out_heads, head_vid, text, " ")
            target[b] = head_vid
            continue
        plain = [t for t, is_title in targets if not is_title]
        if not plain:
            dropped.append(b)
            continue
        for tv in plain:
            numbered.setdefault(tv, "")
        merge(numbered, plain[0], text, " ")
        target[b] = plain[0]

    for h, title in heads.items():
        tv = target.get(h, h)
        merge(out_heads, tv, title, " ")
    if canon is not None:
        fora = [v for v in numbered if v not in canon]
        for v in fora:
            del numbered[v]
        out_heads = {k: t for k, t in out_heads.items() if k in canon}
        target = {k: t for k, t in target.items() if t in canon}
        dropped.extend(fora)
    return Result(numbered, out_heads, target, applied, dropped, choice)


# ---- título como versículo (regra derivada, testada por comprimento de texto) -------------------------------

MERGE_PEN, SPLIT_PEN, ABSENT_PEN, TITLE_PEN, EXTRA_PEN = 3.0, 3.0, 6.0, 2.0, 10.0
TITLE_MARGIN = 2.0  # quanto o título pode custar a mais que o v.1 como versículo e ainda ser adotado


def letters(text: str) -> int:
    """Número de letras e dígitos: sinal de comprimento que não depende do idioma."""
    return len(re.findall(r"\w", text))


def align_chapter(b_len: list[int], k_len: list[int], title_first: bool, title_k: int = 0,
                  force_title: bool = False):
    """Alinha versículos da Bíblia a versículos da KJV de um capítulo pelo comprimento (estilo Gale-Church).

    Movimentos: um-para-um, fusão (2 da Bíblia -> 1 da KJV), divisão (1 -> 2), título (1º da Bíblia sem
    versículo na KJV, só se `title_first`), ausente (KJV sem versículo na Bíblia) e extra. Custo de cada
    par: (b - c*k)^2 / (c*k + 1), com c = razão entre os comprimentos totais.
    Devolve (custo, movimentos em ordem).
    """
    n, m = len(b_len), len(k_len)
    body = b_len[1:] if title_first else b_len
    c = (sum(body) or 1) / (sum(k_len) or 1)

    def g(b: int, k: int) -> float:
        mu = c * k
        return (b - mu) ** 2 / (mu + 1.0)

    title_cost = g(b_len[0], title_k) if (title_first and title_k and n) else TITLE_PEN

    INF = float("inf")
    D = [[INF] * (m + 1) for _ in range(n + 1)]
    BP: list[list] = [[None] * (m + 1) for _ in range(n + 1)]
    D[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            cur = D[i][j]
            if cur == INF:
                continue
            if force_title and i == 0 and j == 0 and n > 0:
                # Hipótese do título: o primeiro versículo da Bíblia é o título, sem alternativa.
                D[1][0] = min(D[1][0], title_cost)
                BP[1][0] = (0, 0, ("title", 0))
                continue
            if force_title and i == 0:
                continue

            def relax(ni: int, nj: int, cost: float, mv: tuple) -> None:
                if cur + cost < D[ni][nj]:
                    D[ni][nj] = cur + cost
                    BP[ni][nj] = (i, j, mv)

            if i < n and j < m:
                relax(i + 1, j + 1, g(b_len[i], k_len[j]), ("one", i, j))
            if i + 1 < n and j < m:
                relax(i + 2, j + 1, g(b_len[i] + b_len[i + 1], k_len[j]) + MERGE_PEN, ("merge", i, j))
            if i < n and j + 1 < m:
                relax(i + 1, j + 2, g(b_len[i], k_len[j] + k_len[j + 1]) + SPLIT_PEN, ("split", i, j))
            if i == 0 and title_first and n > 0:
                relax(1, j, title_cost, ("title", 0))
            if j < m:
                relax(i, j + 1, ABSENT_PEN, ("absent", j))
            if i < n and not (i == 0 and title_first):
                relax(i + 1, j, EXTRA_PEN, ("extra", i))
    moves = []
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, mv = BP[i][j]
        moves.append(mv)
        i, j = pi, pj
    return D[n][m], list(reversed(moves))


def title_as_verse(verses: dict[int, str], heads: dict[int, str], kjv: dict[int, str],
                   index: dict[int, list[Rule]], canon: frozenset[int] | None = None):
    """Regra 'título como versículo' para salmos: o v.1 da Bíblia é o título (sem cabeçalho próprio) e os demais
    versículos deslocam uma posição (ex.: Sinodal, Sl 13 e 87).

    Só age quando a KJV marca título no capítulo (linha em branco antes do v.1) e a TVTMS não já pôs o v.1 no
    título. Compara duas hipóteses pelo comprimento do texto: v.1 como versículo e v.1 como título (forçado). Adota
    a do título se ela cobre todos os versículos sem fusão extra, com um único título, e custa no máximo
    TITLE_MARGIN a mais. Só para capítulos que a TVTMS leva a um único capítulo da KJV. Devolve (overrides para
    reversify, relatório [(capítulo, custo sem título, custo com título, adotado)]).
    """
    base = reversify(verses, heads, index, canon)
    by_chapter: dict[int, list[int]] = defaultdict(list)
    for b in sorted(verses):
        if b // 1_000_000 == 19:
            by_chapter[b // 1000].append(b)
    overrides: dict = {}
    report = []
    for ck, bvids in sorted(by_chapter.items()):
        if bvids[0] % 1000 != 1 or bvids[0] in heads:
            continue  # sem v.1, ou com título já separado (cabeçalho): nada a decidir
        if is_title_action(base.choice[bvids[0]][1]):
            continue  # a TVTMS já põe o v.1 no título (ex.: Sl 5 da LSG: título em dois versículos)
        firsts = [base.choice[b][0][0] for b in bvids
                  if base.choice[b][0] and not is_title_action(base.choice[b][1])]
        chap_of = Counter(tg[0] // 1000 for tg in firsts if not tg[1])
        if not chap_of:
            continue
        if len(chap_of) != 1:
            continue  # a LXX junta capítulos (Sl 9/10...): a TVTMS já decide, e o alinhamento fica de fora
        C = chap_of.most_common(1)[0][0]
        kv = sorted(v for v in kjv if v // 1000 == C)
        if not kv:
            continue
        b_len = [letters(verses[b]) for b in bvids]
        k_len = [letters(kjv[v]) for v in kv]
        cost0, _ = align_chapter(b_len, k_len, False)
        # A KJV marca o título do salmo com linha em branco antes do v.1 ("título\n\nversículo"): é o sinal
        # independente de que o capítulo tem título; sem ele, o título como versículo não existe.
        head_txt, sep, rest = kjv[kv[0]].partition("\n\n")
        if not sep:
            report.append((ck, round(cost0, 1), None, False))
            continue
        k1 = [letters(rest)] + k_len[1:]
        cost1, moves = align_chapter(b_len, k1, True, title_k=letters(head_txt), force_title=True)
        # Só adota se cada versículo da Bíblia tem destino e cada versículo da KJV é coberto (nada 'ausente' nem
        # 'extra') e se o custo com o título não passa do custo sem ele pela folga TITLE_MARGIN. Sem essas
        # garantias, o alinhamento por comprimento deixa texto de fora.
        kinds = {mv[0] for mv in moves}
        adopt = cost1 <= cost0 + TITLE_MARGIN and not kinds & {"absent", "extra"} and sum(mv[0] == "title" for mv in moves) == 1
        report.append((ck, round(cost0, 1), round(cost1, 1), adopt))
        if not adopt:
            continue
        for mv in moves:
            kind = mv[0]
            if kind == "one":
                overrides[bvids[mv[1]]] = (((kv[mv[2]], False),), "alinhamento por comprimento")
            elif kind == "merge":
                for i in (mv[1], mv[1] + 1):
                    overrides[bvids[i]] = (((kv[mv[2]], False),), "alinhamento por comprimento")
            elif kind == "split":
                overrides[bvids[mv[1]]] = (((kv[mv[2]], False), (kv[mv[2] + 1], False)), "alinhamento por comprimento")
            elif kind == "title":
                overrides[bvids[0]] = (((kv[0], True),), "Psalm title")
            elif kind == "extra":
                overrides[bvids[mv[1]]] = ((), "fora do alinhamento")
    return overrides, report
