"""Testes do build_db.py (biblioteca padrão). Rodar: cd pipeline && python3 -m unittest discover tests

Cobrem a escolha do arquivo de saída por edição (o reader não sobrescreve o banco completo) e o
filtro de tabelas por edição.
"""

import sys
import unittest
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))

import build_db  # noqa: E402


class DefaultOutTest(unittest.TestCase):
    def test_full_writes_complete_db(self):
        self.assertEqual(build_db.default_out("full").name, "sensus.db")

    def test_reader_writes_its_own_db(self):
        self.assertEqual(build_db.default_out("reader").name, "sensus-reader.db")

    def test_defaults_share_data_dir(self):
        self.assertEqual(build_db.default_out("full").parent, build_db.default_out("reader").parent)
        self.assertNotEqual(build_db.default_out("full"), build_db.default_out("reader"))


class WantedTest(unittest.TestCase):
    def test_full_keeps_every_table(self):
        self.assertTrue(build_db.wanted("full", "sword-barnes", "commentary"))

    def test_reader_keeps_only_reader_tables(self):
        self.assertTrue(build_db.wanted("reader", "blivre", "verse_text"))
        self.assertFalse(build_db.wanted("reader", "blivre", "commentary"))
        self.assertFalse(build_db.wanted("reader", "sword-barnes", "verse_text"))


if __name__ == "__main__":
    unittest.main()
