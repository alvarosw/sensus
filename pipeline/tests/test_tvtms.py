"""Testes da versificação pela TVTMS (pipeline/bibles/tvtms.py): uma regra por tradição, sem dados externos.

As regras vêm de tests/fixtures/tvtms_trecho.tsv, cópia de linhas da seção Expanded da TVTMS (STEPBible.org,
CC BY 4.0). Casos: hebraico (título de Sl 3 como v.1; Gn 32/31), grego/LXX (Sl 9/10; Sl 146/147), inglês (título
como cabeçalho, sem renumeração) e acréscimos fora do cânon.

Rodar a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "bibles"))

import tvtms as T  # noqa: E402
import versification as V  # noqa: E402
from sensus.refs import vid  # noqa: E402

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "tvtms_trecho.tsv"
SL = 19  # Salmos (livro 19 do cânon)
GN = 1
EST = 17


def load_index():
    rules, dropped = T.load_rules(FIXTURE.read_text(encoding="utf-8-sig"))
    return T.index_rules(rules), rules, dropped


class ParseTest(unittest.TestCase):
    def test_range_across_chapters_gives_both_ends(self):
        self.assertEqual(T.parse_targets("Gen.2:25-3:1"), ((vid(GN, 2, 25), False), (vid(GN, 3, 1), False)))

    def test_multiple_targets_separated_by_semicolon(self):
        self.assertEqual(T.parse_targets("Gen.5:32; 6:1"), ((vid(GN, 5, 32), False), (vid(GN, 6, 1), False)))

    def test_title_target_points_to_verse_one_as_heading(self):
        self.assertEqual(T.parse_targets("Psa.3:Title"), ((vid(SL, 3, 1), True),))

    def test_subverse_suffix_is_dropped_from_target(self):
        self.assertEqual(T.parse_targets("Gen.6:1!a"), ((vid(GN, 6, 1), False),))

    def test_fixture_clauses_are_all_understood(self):
        _, rules, dropped = load_index()
        self.assertGreater(len(rules), 200)
        unknown = [c for r in rules for c in r.tests if c[0] == "false"]
        self.assertEqual(unknown, [], "cláusula de teste fora da gramática conhecida")

    def test_words_count_ideographs_as_units(self):
        self.assertEqual(T.units("耶和华是我的牧者"), 8)
        self.assertEqual(T.units("Deus amou o mundo"), 4)


def chapter(book, ch, n, prefix="v"):
    return {vid(book, ch, v): f"{prefix}{v}" for v in range(1, n + 1)}


class HebrewTest(unittest.TestCase):
    """Sl 3 hebraico: o título é o v.1 (9 versículos numerados); a KJV tem 8 e o título vira cabeçalho."""

    def test_title_becomes_heading_of_kjv_verse_one(self):
        index, _, _ = load_index()
        verses = chapter(SL, 3, 9)
        verses[vid(SL, 3, 1)] = "Salmo de Davi, quando fugia de Absalão."
        res = T.reversify(verses, {}, index)
        self.assertIn("Salmo de Davi", res.heads[vid(SL, 3, 1)])
        self.assertEqual(sorted(res.numbered), [vid(SL, 3, n) for n in range(1, 9)])
        self.assertEqual(res.numbered[vid(SL, 3, 1)], "v2")  # o texto do v.2 hebraico vai ao v.1 da KJV
        self.assertEqual(res.numbered[vid(SL, 3, 8)], "v9")

    def test_hebrew_gen_32_first_verse_goes_to_kjv_31_55(self):
        index, _, _ = load_index()
        verses = {**chapter(GN, 31, 54, prefix="a"), **chapter(GN, 32, 33, prefix="b")}
        res = T.reversify(verses, {}, index)
        self.assertEqual(res.target[vid(GN, 32, 1)], vid(GN, 31, 55))
        self.assertEqual(res.numbered[vid(GN, 31, 55)], "b1")
        self.assertEqual(res.numbered[vid(GN, 32, 1)], "b2")
        self.assertEqual(len([v for v in res.numbered if v // 1000 == GN * 1000 + 32]), 32)


class EnglishTest(unittest.TestCase):
    """Sl 3 em inglês: 8 versículos, título como cabeçalho. Nada é renumerado."""

    def test_identity_and_heading_kept(self):
        index, _, _ = load_index()
        verses = chapter(SL, 3, 8)
        res = T.reversify(verses, {vid(SL, 3, 1): "A Psalm of David."}, index)
        self.assertEqual(res.numbered, {vid(SL, 3, n): f"v{n}" for n in range(1, 9)})
        self.assertEqual(res.heads, {vid(SL, 3, 1): "A Psalm of David."})


class GreekTest(unittest.TestCase):
    """Sl 9 grego (LXX): 39 versículos; o título é o v.1, e Sl 9:22-39 viram Sl 10:1-18."""

    def test_psalm_nine_and_ten_split(self):
        index, _, _ = load_index()
        verses = chapter(SL, 9, 39)
        verses[vid(SL, 9, 30)] = "v30"  # sonda da TVTMS: Sl 9:30 existe só na numeração grega
        res = T.reversify(verses, {}, index)
        self.assertEqual(res.target[vid(SL, 9, 22)], vid(SL, 10, 1))
        self.assertEqual(res.target[vid(SL, 9, 39)], vid(SL, 10, 18))
        self.assertEqual(res.numbered[vid(SL, 9, 1)], "v2")
        self.assertEqual(res.numbered[vid(SL, 9, 20)], "v21")
        self.assertEqual(res.numbered[vid(SL, 10, 1)], "v22")
        self.assertEqual(len([v for v in res.numbered if v // 1000 == SL * 1000 + 9]), 20)
        self.assertEqual(len([v for v in res.numbered if v // 1000 == SL * 1000 + 10]), 18)

    def test_psalm_146_lxx_becomes_147(self):
        index, _, _ = load_index()
        verses = chapter(SL, 146, 11)
        verses[vid(SL, 9, 30)] = "x"
        res = T.reversify(verses, {}, index)
        self.assertEqual(res.target[vid(SL, 146, 1)], vid(SL, 147, 1))
        self.assertEqual(res.target[vid(SL, 146, 2)], vid(SL, 147, 2))


class CanonTest(unittest.TestCase):
    def test_additions_outside_the_protestant_canon_are_left_out(self):
        index, _, _ = load_index()
        verses = {vid(EST, 10, 1): "x", vid(EST, 11, 1): "acréscimo grego"}
        canon = frozenset([vid(EST, 10, 1)])
        res = T.reversify(verses, {}, index, canon)
        self.assertEqual(set(res.numbered), {vid(EST, 10, 1)})
        self.assertIn(vid(EST, 11, 1), res.dropped)


class OmissionAndBridgeCountTest(unittest.TestCase):
    """Os 16 versículos do texto crítico e as pontes não contam contra a KJV (versificacao.compare)."""

    def test_missing_critical_omission_does_not_count(self):
        kjv = {**chapter(40, 17, 27), **chapter(40, 18, 35)}
        bib = {k: v for k, v in kjv.items() if k != vid(40, 17, 21)}
        rep = V.compare(bib, kjv)
        self.assertEqual(rep["bad"], [])

    def test_bridged_verse_is_numbered_without_text(self):
        kjv = chapter(40, 1, 3)
        bib = {vid(40, 1, 1): "um", vid(40, 1, 2): "dois e três", vid(40, 1, 3): ""}
        self.assertEqual(V.compare(bib, kjv)["bad"], [])


class LengthAlignmentTest(unittest.TestCase):
    """Alinhamento por comprimento (usado quando a TVTMS não decide o título) e checagens de texto e de título."""

    def test_one_to_one_costs_nothing_and_merge_is_found(self):
        cost, moves = T.align_chapter([10, 20, 30], [10, 20, 30], False)
        self.assertLess(cost, 1e-6)
        self.assertEqual(moves, [("one", 0, 0), ("one", 1, 1), ("one", 2, 2)])
        _, moves = T.align_chapter([10, 22], [11], False)
        self.assertEqual(moves[0][0], "merge")

    def test_title_as_separate_verse_is_adopted_and_shift_follows(self):
        index, _, _ = load_index()
        # Capítulo de salmo: v.1 = título (sem cabeçalho próprio), v.2..v.5 = versículos da KJV 1..4.
        kjv = {vid(SL, 90, 1): "Prayer of Moses.\n\n" + "a " * 40, vid(SL, 90, 2): "b " * 30,
               vid(SL, 90, 3): "c " * 30, vid(SL, 90, 4): "d " * 30}
        verses = {vid(SL, 90, 1): "Molitva " * 3, vid(SL, 90, 2): "a " * 40,
                  vid(SL, 90, 3): "b " * 30, vid(SL, 90, 4): "c " * 30, vid(SL, 90, 5): "d " * 30}
        overrides, report = T.title_as_verse(verses, {}, kjv, index, frozenset(kjv))
        self.assertTrue(any(r[3] for r in report), report)
        self.assertEqual(overrides[vid(SL, 90, 1)][1], "Psalm title")
        self.assertEqual(overrides[vid(SL, 90, 2)][0][0][0], vid(SL, 90, 1))

    def test_text_check_flags_a_shifted_psalm_and_not_an_aligned_one(self):
        kjv = {vid(SL, 50, n): "x" * (n * 10) for n in range(1, 9)}
        good = {v: kjv[v] for v in kjv}
        shifted = {vid(SL, 50, n): kjv[vid(SL, 50, n + 1)] if n < 8 else "" for n in range(1, 9)}
        self.assertEqual(V.text_check(good, kjv), [])
        self.assertTrue(V.text_check(shifted, kjv))

    def test_title_check_compares_kjv_title_with_heading(self):
        kjv = {vid(SL, 3, 1): "Psalm of David.\n\nLord, how.", vid(SL, 4, 1): "Hear me."}
        self.assertIn(3, [f["chapter"] for f in V.title_check({}, kjv)])
        self.assertEqual(V.title_check({vid(SL, 3, 1): "Salmo."}, kjv), [])
        self.assertIn(4, [f["chapter"] for f in V.title_check({vid(SL, 4, 1): "Salmo."}, kjv)])


if __name__ == "__main__":
    unittest.main()
