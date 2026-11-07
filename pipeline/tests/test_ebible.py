"""Testes do ingestor eBible (USFM): versículo, nota removida, Strong removido, títulos, parágrafos e \\toc.

Rodar a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "ingest"))

import ebible  # noqa: E402

USFM = r"""\id PHP - Teste
\toc1 The Letter to the Philippians
\toc2 Philippians
\toc3 Phil
\c 1
\s1 Saudação
\p
\v 1 \w Paulo|strong="G3972"\w* e \w Timóteo|strong="G5095"\w*, \f + \fr 1:1 \ft Nota de rodapé.\f* servos de Cristo.
\v 2 Graça a vós \x - \xo 1:2 \xt Rm 1:7\x* e paz.
\q1 Continuação do versículo 2.
\v 3 \q1 Dou graças \add ao meu Deus\add*.
\c 2
\d Salmo de teste
\v 1 Primeiro do capítulo 2.
"""


class ParseUsfmTest(unittest.TestCase):
    def setUp(self):
        self.p = ebible.parse_usfm(USFM)

    def test_book_code_and_toc_names(self):
        self.assertEqual(self.p["code"], "PHP")
        self.assertEqual(self.p["names"], {"toc1": "The Letter to the Philippians", "toc2": "Philippians", "toc3": "Phil"})

    def test_verses_by_chapter(self):
        ids = [(c, v) for c, v, _ in self.p["verses"]]
        self.assertEqual(ids, [(1, 1), (1, 2), (1, 3), (2, 1)])

    def test_strong_attributes_and_notes_are_removed(self):
        text = dict(((c, v), t) for c, v, t in self.p["verses"])
        self.assertEqual(text[(1, 1)], "Paulo e Timóteo, servos de Cristo.")
        self.assertNotIn("strong", text[(1, 1)])
        self.assertNotIn("Nota de rodapé", text[(1, 1)])

    def test_cross_reference_removed_and_continuation_joined(self):
        text = dict(((c, v), t) for c, v, t in self.p["verses"])
        self.assertEqual(text[(1, 2)], "Graça a vós e paz. Continuação do versículo 2.")

    def test_poetry_marker_and_added_word_do_not_leak(self):
        text = dict(((c, v), t) for c, v, t in self.p["verses"])
        self.assertEqual(text[(1, 3)], "Dou graças ao meu Deus.")

    def test_heading_goes_to_next_verse(self):
        self.assertIn((1, 1, "Saudação"), self.p["heads"])

    def test_psalm_title_goes_to_first_verse_as_heading(self):
        self.assertIn((2, 1, "Salmo de teste"), self.p["heads"])
        self.assertNotIn("Salmo de teste", dict(((c, v), t) for c, v, t in self.p["verses"])[(2, 1)])

    def test_paragraph_start_recorded(self):
        self.assertIn((1, 1), self.p["paras"])

    def test_verse_range_is_recorded_for_the_check(self):
        p = ebible.parse_usfm("\\id GEN\n\\c 13\n\\v 3-4 Texto fundido.\n")
        self.assertEqual(p["ranges"], [(13, 3, "3-4")])


class CleanTest(unittest.TestCase):
    def test_removes_strong_and_keeps_words(self):
        self.assertEqual(ebible.clean('\\w In|strong="H8064"\\w* \\w beginning|strong="H7225"\\w*'), "In beginning")

    def test_removes_footnote_and_figure(self):
        s = "Antes \\f + \\fr 3:1 \\ft texto da nota\\f* depois \\fig legenda|src.jpg\\fig* fim"
        self.assertEqual(ebible.clean(s), "Antes depois fim")

    def test_no_markup_left(self):
        self.assertNotIn("\\", ebible.clean("\\add x\\add* \\nd Senhor\\nd* \\+w y\\+w*"))


class SplitVerseMarkersTest(unittest.TestCase):
    def test_verse_in_the_middle_of_a_poetry_line_starts_a_new_line(self):
        self.assertEqual(ebible.split_verse_markers("\\q1 \\v 5 texto"), ["\\q1", "\\v 5 texto"])


if __name__ == "__main__":
    unittest.main()
