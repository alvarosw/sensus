"""Testes do repositório de Bíblias: versificação (contagem por capítulo), pacote SQLite/zip/manifesto e nomes.

Rodar a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import json
import sqlite3
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "bibles"))

import book_names  # noqa: E402
import package_bibles as P  # noqa: E402
import versification as V  # noqa: E402
from sensus.refs import vid  # noqa: E402


def chapter(book, ch, n, text="x"):
    """Mapa vid -> texto para um capítulo com n versículos."""
    return {vid(book, ch, v): f"{text} {v}" for v in range(1, n + 1)}


class VersificationTest(unittest.TestCase):
    def setUp(self):
        self.kjv = {**chapter(40, 1, 3), **chapter(40, 2, 2)}

    def test_identical_numbering_passes(self):
        rep = V.compare(dict(self.kjv), self.kjv)
        self.assertEqual(rep["bad"], [])
        self.assertTrue(V.passes(rep))

    def test_numbered_verse_without_text_still_counts_as_numbering(self):
        bib = dict(self.kjv)
        bib[vid(40, 1, 2)] = ""  # omissão de texto (ex.: Atos 8:37), numeração presente
        rep = V.compare(bib, self.kjv)
        self.assertEqual(rep["bad"], [])
        self.assertEqual(rep["empty"], [vid(40, 1, 2)])

    def test_missing_verse_is_a_chapter_mismatch(self):
        bib = dict(self.kjv)
        del bib[vid(40, 1, 3)]
        rep = V.compare(bib, self.kjv)
        self.assertEqual(rep["bad"], [(40, 1, 3, 2, 0)])

    def test_psalm_style_extra_verse_is_detected(self):
        # Título de salmo tratado como versículo 1: a tradução tem um versículo a mais.
        bib = {**chapter(40, 1, 4), **chapter(40, 2, 2)}
        rep = V.compare(bib, self.kjv)
        self.assertEqual(rep["bad"], [(40, 1, 3, 4, 0)])

    def test_critical_omissions_are_sixteen_and_john_is_not_job(self):
        self.assertEqual(len(V.OMISSOES_TEXTO_CRITICO), 16)
        self.assertIn(vid(43, 5, 4), V.OMISSOES_TEXTO_CRITICO)  # João 5:4 (Jn), não Jó 5:4
        self.assertNotIn(vid(18, 5, 4), V.OMISSOES_TEXTO_CRITICO)

    def test_critical_omission_missing_or_empty_does_not_count(self):
        kjv = {**chapter(40, 17, 27), **chapter(40, 18, 35)}
        for bib_v in ({k: t for k, t in kjv.items() if k != vid(40, 17, 21)}, {**kjv, vid(40, 17, 21): ""}):
            self.assertEqual(V.compare(bib_v, kjv)["bad"], [])

    def test_threshold_is_995_per_cent_of_chapters(self):
        # KJV sintética com os 1189 capítulos do cânon, dois versículos cada.
        from sensus.refs import BOOKS
        kjv = {}
        chapters = [(b[0], c) for b in BOOKS for c in range(1, b[5] + 1)]
        for book, c in chapters:
            kjv.update(chapter(book, c, 2))
        self.assertEqual(len(chapters), 1189)

        def drop_one_verse_in(n):
            bib = dict(kjv)
            for book, c in chapters[:n]:
                del bib[vid(book, c, 2)]
            return bib

        # 5 capítulos diferentes: 1184/1189 = 99,58% passa; 6: 1183/1189 = 99,49% não passa.
        self.assertTrue(V.passes(V.compare(drop_one_verse_in(5), kjv)))
        self.assertFalse(V.passes(V.compare(drop_one_verse_in(6), kjv)))


class SqlitePackageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.db = self.tmp / "bible-teste.db"
        self.verses = {vid(40, 1, 1): "Um.", vid(40, 1, 2): "", vid(40, 1, 3): "Três."}
        self.divs = [
            {"vid": vid(40, 1, 1), "kind": "paragraph", "title": None},
            {"vid": vid(40, 1, 1), "kind": "heading", "title": "Início"},
            {"vid": vid(40, 1, 2), "kind": "paragraph", "title": None},  # vid sem texto: fora
        ]
        self.books = [{"book": 40, "name": "Mateus", "short": "Mateus", "abbr": "Mat"}]
        P.build_sqlite(self.db, bible_id="teste", version="2026.11.06", lang="pt", license_="Public Domain",
                       attribution="Atribuição de teste", verses=self.verses, divisions=self.divs,
                       books=self.books, built_at="2026-11-06T00:00:00+00:00")

    def test_schema_matches_contract(self):
        con = sqlite3.connect(self.db)
        try:
            names = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertEqual(names, {"meta", "verse_text", "text_division", "book_name"})
            meta = dict(con.execute("SELECT key, value FROM meta").fetchall())
            self.assertEqual(
                set(meta), {"bible_id", "version", "lang", "schema_version", "built_at", "license", "attribution"}
            )
            self.assertEqual(meta["schema_version"], "1")
            self.assertEqual(con.execute("SELECT source_id, vid, text FROM verse_text ORDER BY vid").fetchall(),
                             [("teste", vid(40, 1, 1), "Um."), ("teste", vid(40, 1, 3), "Três.")])
            self.assertEqual(con.execute("SELECT cite_id FROM verse_text ORDER BY vid").fetchall(),
                             [("txt:teste:40001001",), ("txt:teste:40001003",)])
            self.assertEqual(con.execute("SELECT COUNT(*) FROM text_division").fetchone()[0], 2)
            self.assertEqual(con.execute("SELECT name, short, abbr FROM book_name").fetchall(),
                             [("Mateus", "Mateus", "Mat")])
        finally:
            con.close()

    def test_zip_has_single_entry_named_after_db(self):
        zp = self.tmp / "bible-teste-2026.11.06.zip"
        P.write_zip(self.db, zp)
        with zipfile.ZipFile(zp) as z:
            self.assertEqual(z.namelist(), ["bible-teste.db"])
            self.assertIsNone(z.testzip())

    def test_manifest_entry_points_to_release_asset(self):
        pkg = P.package_entry("teste", "2026.11.06")
        self.assertEqual(
            pkg["url"],
            "https://github.com/alvarosw/sensus/releases/download/bibles-2026.11.06/bible-teste-2026.11.06.zip",
        )

    def test_manifest_shape(self):
        m = P.manifest_for([{"id": "blivre", "bundled": True}], "2026.11.06")
        self.assertEqual(set(m), {"catalog_version", "schema_version", "bibles"})
        self.assertEqual(m["schema_version"], 1)
        self.assertTrue(m["bibles"][0]["bundled"])
        self.assertNotIn("package", m["bibles"][0])
        json.dumps(m)


class BookNamesTest(unittest.TestCase):
    def test_core_names_have_66_books_in_order(self):
        for lang in ("pt", "en"):
            names = book_names.core_names(lang)
            self.assertEqual(len(names), 66)
            self.assertEqual([b["book"] for b in names], list(range(1, 67)))
        self.assertEqual(book_names.core_names("pt")[0]["name"], "Gênesis")
        self.assertEqual(book_names.core_names("en")[0]["abbr"], "GEN")

    def test_render_quotes_and_escapes(self):
        table = {"en": book_names.core_names("en")}
        ts = book_names.render(table)
        self.assertIn("export const BOOK_NAMES", ts)
        self.assertIn("import type { AppLang } from './locale';", ts)
        self.assertEqual(ts.count("{ name: '"), 66)
        self.assertEqual(book_names.ts_str("l'homme"), "'l\\'homme'")


if __name__ == "__main__":
    unittest.main()
