"""Regra única de strong_base (pipeline/sensus/strong.py).

Rodar a partir da raiz do repositório: python3 -m unittest discover -s pipeline/tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.strong import parse_strong, strong_base  # noqa: E402


class StrongBaseTest(unittest.TestCase):
    def test_remove_sufixo(self):
        self.assertEqual(strong_base("H0935P"), "H0935")
        self.assertEqual(strong_base("G2424G"), "G2424")
        self.assertEqual(strong_base("H2148v"), "H2148")  # sufixo minúsculo, como na fonte

    def test_sem_sufixo_fica_igual(self):
        self.assertEqual(strong_base("G5124"), "G5124")
        self.assertEqual(strong_base("H0907"), "H0907")

    def test_normaliza_zeros_a_esquerda(self):
        self.assertEqual(strong_base("G430"), "G0430")
        self.assertEqual(strong_base("H7A"), "H0007")

    def test_cinco_digitos_ficam_inteiros(self):
        # TBESG tem chaves como G20001 (sem tokens); não podem virar 'G2000'.
        self.assertEqual(strong_base("G20001"), "G20001")
        self.assertEqual(strong_base("G20001A"), "G20001")

    def test_invalidos(self):
        for bad in ["", "G", "X1234", "g2424", "G2424 ", " G2424", "G123456", "2424G", "G-1"]:
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    strong_base(bad)


class ParseStrongTest(unittest.TestCase):
    def test_partes(self):
        self.assertEqual(parse_strong("H0935P"), ("H", 935, "P"))
        self.assertEqual(parse_strong("G5124"), ("G", 5124, ""))

    def test_nao_strong(self):
        self.assertIsNone(parse_strong("nope"))
        self.assertIsNone(parse_strong("G2424\n"))


if __name__ == "__main__":
    unittest.main()
