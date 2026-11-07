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


from sensus.registry import missing_sources, registered_sources  # noqa: E402

SAMPLE_TS = """
const OT_NT = ['OT', 'NT'];
export const SOURCES: Readonly<Record<string, SourceInfo>> = {
  // ---- textos
  blivre: { short: 'Bíblia Livre', role: 'text', testaments: OT_NT },
  'sword-kd': { short: 'Keil e Delitzsch', commentator: 'Keil e Delitzsch', role: 'commentary' },
  'egw-great-controversy': {
    short: 'Grande Conflito',
    role: 'commentary',
  },
};

export const TRADITIONS = {
  reformed: { pt: 'reformada' },
};
"""


class RegistryTest(unittest.TestCase):
    def test_reads_only_sources_block(self):
        self.assertEqual(registered_sources(SAMPLE_TS), {"blivre", "sword-kd", "egw-great-controversy"})

    def test_missing_lists_registered_without_staging(self):
        self.assertEqual(missing_sources({"blivre", "sword-kd", "extra"}, SAMPLE_TS), ["egw-great-controversy"])

    def test_nothing_missing(self):
        self.assertEqual(missing_sources({"blivre", "sword-kd", "egw-great-controversy"}, SAMPLE_TS), [])

    def test_real_registry_is_parsed(self):
        from sensus.registry import SOURCES_TS
        ids = registered_sources(SOURCES_TS.read_text(encoding="utf-8"))
        # Textos, comentários adventistas e do lote 1 precisam estar no registro lido.
        for sid in ("blivre", "kjv", "tagnt", "egw-great-controversy", "smith-daniel", "sword-abbott"):
            self.assertIn(sid, ids)
