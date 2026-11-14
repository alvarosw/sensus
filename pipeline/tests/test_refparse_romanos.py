"""Testes de ingest/refparse.py: cabeçalhos de passagem com capítulo romano ou arábico (roman_to_int, passagem_cabecalho).

Precisa do pysword (ingest/refparse.py); sem ele, o teste é pulado. Rodar a partir da pasta pipeline:
python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from ingest import refparse as R  # noqa: E402
    from sensus.refs import vid  # noqa: E402
except ImportError:  # sem pysword
    R = None


@unittest.skipIf(R is None, "precisa de pysword (ingest/refparse.py)")
class CabecalhoRomano(unittest.TestCase):
    def test_romanos(self):
        self.assertEqual(R.roman_to_int("xv"), 15)
        self.assertEqual(R.roman_to_int("cxxxiv"), 134)
        self.assertEqual(R.roman_to_int("XIX"), 19)
        self.assertEqual(R.roman_to_int("ill"), 99)  # OCR: quem trata "ill" troca por "iii" antes
        self.assertIsNone(R.roman_to_int("xq"))
        self.assertIsNone(R.roman_to_int(""))

    def test_at_capitulo_romano_com_intervalo(self):
        # AT: Gênesis xv. 5-18 (cabeçalho de sermão de Maclaren)
        self.assertEqual(R.passagem_cabecalho("Genesis xv. 5-18"), (vid(1, 15, 5), vid(1, 15, 18)))
        self.assertEqual(R.passagem_cabecalho("Joshua i. 7, 8"), (vid(6, 1, 7), vid(6, 1, 8)))
        self.assertEqual(R.passagem_cabecalho("Ezra vi. 14-22"), (vid(15, 6, 14), vid(15, 6, 22)))
        self.assertEqual(R.passagem_cabecalho("Acts v. 17-32"), (vid(44, 5, 17), vid(44, 5, 32)))

    def test_at_intervalo_entre_capitulos(self):
        # "Genesis i. 26--ii. 3": de 1:26 a 2:3
        self.assertEqual(R.passagem_cabecalho("Genesis i. 26--ii. 3"), (vid(1, 1, 26), vid(1, 2, 3)))

    def test_capitulo_inteiro_e_salmo(self):
        self.assertEqual(R.passagem_cabecalho("Esther iii."), (vid(17, 3, 1), vid(17, 3, 15)))
        self.assertEqual(R.passagem_cabecalho("PSALM cxxxiv"), (vid(19, 134, 1), vid(19, 134, 3)))

    def test_nt_arabico_e_lista_de_versiculos(self):
        # NT: João iii. 16 e Filipenses iv. 13 (lista "37,38" vira intervalo)
        self.assertEqual(R.passagem_cabecalho("JOHN iii. 16"), (vid(43, 3, 16), vid(43, 3, 16)))
        self.assertEqual(R.passagem_cabecalho("John vii. 37,38"), (vid(43, 7, 37), vid(43, 7, 38)))
        self.assertEqual(R.passagem_cabecalho("Phil. iv. 10-14"), (vid(50, 4, 10), vid(50, 4, 14)))
        self.assertEqual(R.passagem_cabecalho("Philippians iv. 13"), (vid(50, 4, 13), vid(50, 4, 13)))

    def test_rejeita_o_que_nao_e_passagem_valida(self):
        self.assertIsNone(R.passagem_cabecalho("Genesis xv. 25"))  # versículo que não existe
        self.assertIsNone(R.passagem_cabecalho("Galatians vi. 25"))  # erro do original (ver DATA_LICENSES.md)
        self.assertIsNone(R.passagem_cabecalho("Genesis xc. 1"))  # capítulo que não existe
        self.assertIsNone(R.passagem_cabecalho("Introduction to the book"))  # não é referência
        self.assertIsNone(R.passagem_cabecalho("Genesis xv. 5 and more text here"))


if __name__ == "__main__":
    unittest.main()
