"""Testes de ingest/tdavid.py: divisão do comentário de Spurgeon (Treasury of David) por versículo.

Os trechos são do próprio módulo TDavid (Salmos 117 e 20), cortados nas primeiras frases de cada parágrafo.
Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest import tdavid  # noqa: E402

BASE_117 = 19117001  # Sl 117:1 em vid (livro 19, capítulo 117)
BASE_20 = 19020001

# Sl 117 (o menor salmo): visão geral, Exposição v.1 e v.2, notas e dicas de v.2 e de todo o salmo.
SL_117 = """Psalm 117 OVERVIEW

SUBJECT. This Psalm, which is very little in its letter, is exceedingly large in its spirit; for, bursting beyond all bounds of race or nationality, it calls upon all mankind to praise the name of the Lord.

EXPOSITION

Verse 1. O praise the LORD, all ye nations. This is an exhortation to the Gentiles to glorify Jehovah.

Verse 2. For his merciful kindness is great toward us. By which is meant not only his great love toward the Jewish people.

EXPLANATORY NOTES AND QUAINT SAYINGS

Whole Psalm. A very short Psalm if you regard the words, but of very great compass.

Verse 2. Merciful kindness. In God's kindness there is mercy, because,

1. Our sin deserves the reverse of kindness.

HINTS TO THE VILLAGE PREACHER

Whole Psalm. The universal kingdom.

Verse 2 (last clause)

1. In his attribute —he is always faithful.
"""

# Sl 20: "Verses 1-3." é um marcador de intervalo; o parágrafo vale para os três versículos.
SL_20 = """Psalm 20 OVERVIEW

SUBJECT. We have before us a National Anthem, fitted to be sung at the outbreak of war.

EXPOSITION

Verse 1. "The Lord hear thee in the day of trouble." All loyal subjects pray for their king.

Verse 2. "Send thee help from the sanctuary." Out of heaven's sanctuary came the help.

Verse 3. "Remember all thy offerings, and accept thy burnt sacrifice. Selah." Be it so.

HINTS TO THE VILLAGE PREACHER

Verses 1-3. A model of good wishes for our friends.

Verse 4. The prayer for the king's heart.

WORKS UPON THE TWENTIETH PSALM

Some other author's book, which is not commentary on this Psalm.
"""


def by_range(rows):
    return {(s, e): t for s, e, t in rows}


class SalmosDoTdavid(unittest.TestCase):
    def test_visao_geral_fica_no_versiculo_1(self):
        rows = by_range(tdavid.psalm_rows(BASE_117, SL_117))
        self.assertIn((BASE_117, BASE_117), rows)
        v1 = rows[(BASE_117, BASE_117)]
        self.assertIn("SUBJECT. This Psalm", v1)
        self.assertIn("Verse 1. O praise the LORD", v1)
        self.assertIn("Whole Psalm. A very short Psalm", v1)
        self.assertIn("Whole Psalm. The universal kingdom.", v1)
        self.assertNotIn("Verse 2.", v1)

    def test_cada_versiculo_recebe_so_o_seu(self):
        rows = by_range(tdavid.psalm_rows(BASE_117, SL_117))
        v2 = rows[(BASE_117 + 1, BASE_117 + 1)]
        self.assertIn("For his merciful kindness", v2)
        self.assertIn("Merciful kindness. In God's kindness", v2)
        self.assertIn("1. Our sin deserves the reverse", v2)
        self.assertIn("Verse 2 (last clause)", v2)
        self.assertIn("1. In his attribute", v2)
        self.assertNotIn("O praise the LORD", v2)
        self.assertNotIn("SUBJECT.", v2)

    def test_cabecalhos_de_secao_saem_do_texto(self):
        for s, e, t in tdavid.psalm_rows(BASE_117, SL_117):
            for head in ("EXPOSITION", "EXPLANATORY NOTES AND QUAINT SAYINGS", "HINTS TO THE VILLAGE PREACHER"):
                self.assertNotIn(head, t)
            self.assertNotIn("Psalm 117 OVERVIEW", t)

    def test_intervalo_verses_1_a_3(self):
        rows = by_range(tdavid.psalm_rows(BASE_20, SL_20))
        self.assertIn((BASE_20, BASE_20 + 2), rows)
        self.assertIn("Verses 1-3. A model of good wishes for our friends.", rows[(BASE_20, BASE_20 + 2)])
        # o intervalo não se espalha para o versículo 4, que tem texto próprio
        self.assertNotIn("A model of good wishes", rows[(BASE_20 + 3, BASE_20 + 3)])
        self.assertIn("The prayer for the king's heart.", rows[(BASE_20 + 3, BASE_20 + 3)])
        # os versículos 1, 2 e 3 também têm a sua exposição, separada do intervalo
        self.assertIn('"The Lord hear thee in the day of trouble."', rows[(BASE_20, BASE_20)])
        self.assertIn("Out of heaven's sanctuary", rows[(BASE_20 + 1, BASE_20 + 1)])

    def test_bibliografia_sai(self):
        rows = tdavid.psalm_rows(BASE_20, SL_20)
        for s, e, t in rows:
            self.assertNotIn("Some other author's book", t)
            self.assertNotIn("WORKS UPON", t)

    def test_marcador_de_lista_e_ver_abreviado(self):
        # "Ver. 2,4-5,8." (salmo 119): cada item da lista vira seu intervalo
        texto = ("Ver. 2,4-5,8. Blessed are they that keep. Texto de lista.\n\n"
                 "Ver. 9. Texto do nono.")
        spans = [(s, e) for s, e, _ in tdavid.psalm_segments(texto) if "Texto de lista" in _]
        self.assertEqual(spans, [(2, 2), (4, 5), (8, 8)])
        self.assertEqual(
            [(s, e) for s, e, t in tdavid.psalm_segments(texto) if "Texto do nono" in t], [(9, 9)])

    def test_numero_com_ocr_l(self):
        self.assertEqual(tdavid._spans("l0"), [(10, 10)])


if __name__ == "__main__":
    unittest.main()
