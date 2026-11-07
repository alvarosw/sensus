"""Testes de sensus/adventist_texto.py (regras das obras adventistas: capítulos, seções, rodapés). Regra nova = caso de
AT (Daniel, hebraico) e de NT (Gálatas, grego). Os textos de exemplo são linhas reais dos scans e do Gutenberg.

Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.adventist_texto import (  # noqa: E402
    BASED_ON, CHAPTER_HEAD, REF_LINE, SECTION_HEAD, next_chapter, roman_value, section_span, tira_notas, to_roman,
)
from sensus.refs import vid  # noqa: E402

DANIEL = 27  # AT, hebraico
GALATIANS = 48  # NT, grego


class RomanosTest(unittest.TestCase):
    def test_to_roman_inclui_40_50_90_100(self):
        # Antes, 40 saía "XXXX" (Andrews: capítulo XLIV saiu "XXXXIV").
        self.assertEqual(to_roman(4), "IV")
        self.assertEqual(to_roman(9), "IX")
        self.assertEqual(to_roman(40), "XL")
        self.assertEqual(to_roman(44), "XLIV")
        self.assertEqual(to_roman(50), "L")
        self.assertEqual(to_roman(87), "LXXXVII")
        self.assertEqual(to_roman(90), "XC")
        self.assertEqual(to_roman(100), "C")

    def test_roman_value(self):
        self.assertEqual(roman_value("XIV"), 14)
        self.assertEqual(roman_value("XL"), 40)
        self.assertIsNone(roman_value("UAL"))  # OCR de "VI"
        self.assertIsNone(roman_value(""))


class CapituloEmSequenciaTest(unittest.TestCase):
    def test_proximo_capitulo_e_o_seguinte(self):
        self.assertEqual(next_chapter("X", "XI"), "XI")  # o normal
        self.assertEqual(next_chapter("XI", "XIII"), "XIII")  # o XII perdido pelo OCR (Haskell, Daniel)

    def test_romano_fora_de_sequencia_vale_o_proximo(self):
        self.assertEqual(next_chapter("X", "XL"), "XI")  # "XL" lido por "XI"
        self.assertEqual(next_chapter("XVI", "UAL"), "XVII")  # OCR ilegível
        self.assertEqual(next_chapter("XI", "XII"), "XII")

    def test_palavra_no_lugar_do_romano(self):
        self.assertEqual(next_chapter(None, "ONE"), "I")  # Desire of Ages: "CHAPTER ONE."
        self.assertEqual(next_chapter("XXVI", "TWENTY-SEVEN."), "XXVII")
        self.assertEqual(next_chapter("LXXXVI", "EIGHTY-SEVEN."), "LXXXVII")

    def test_romano_com_ocr_corrigido(self):
        self.assertEqual(next_chapter("II", "IIL"), "III")  # ROMAN_OCR

    def test_cabecalho_casa_so_linha_de_capitulo(self):
        m = re.match(CHAPTER_HEAD, "CHAPTER  EIGHTY-SEVEN.")
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "EIGHTY-SEVEN.")
        self.assertIsNotNone(re.match(CHAPTER_HEAD, "CHAPTER: Vit"))
        self.assertIsNotNone(re.match(CHAPTER_HEAD, "CHAPTER UAL "))
        # Cabeçalho corrente ("CHAPTER 2, VERSES 1-4 33") e frase que começa com a palavra não são capítulo.
        self.assertIsNone(re.match(CHAPTER_HEAD, "CHAPTER 2, VERSES 1-4 33"))
        self.assertIsNone(re.match(CHAPTER_HEAD, "CHAPTERS of the book are short."))


class TituloDeSecaoTest(unittest.TestCase):
    def test_intervalo_de_versiculos_de_daniel(self):
        m = SECTION_HEAD.search("THE HISTORY OF GREECE (Chapter 11: 3-13)")
        self.assertIsNotNone(m)
        self.assertEqual(section_span(DANIEL, m), (vid(DANIEL, 11, 3), vid(DANIEL, 11, 13)))

    def test_versiculos_separados_por_virgula(self):
        m = SECTION_HEAD.search("THE HISTORY OF THE DECREES (Chapter 11:1, 2)")
        self.assertEqual(section_span(DANIEL, m), (vid(DANIEL, 11, 1), vid(DANIEL, 11, 2)))

    def test_titulo_so_de_capitulo_nao_e_secao(self):
        # "(Chapter 5)" não diz versículo: não liga parágrafo nenhum.
        self.assertIsNone(SECTION_HEAD.search("THE HANDWRITING ON THE WALL (Chapter 5)"))


class NotasDeRodapeTest(unittest.TestCase):
    def test_nota_com_marca_de_ocr_sai_do_texto(self):
        texto, notas = tira_notas("the Lord, *Phil. 3:21, R. V. sentcd in the Saviour's life on earth.")
        self.assertEqual(texto, "the Lord, sentcd in the Saviour's life on earth.")
        self.assertEqual(notas, ["*Phil. 3:21, R. V."])

    def test_citacao_no_meio_da_frase_fica(self):
        # Sem marca de nota, a referência é prosa: fica no texto (e gera linha, pelo refparse).
        texto, notas = tira_notas("as Paul says in Gal. 2:16 that a man is not justified.")
        self.assertEqual(texto, "as Paul says in Gal. 2:16 that a man is not justified.")
        self.assertEqual(notas, [])

    def test_nota_de_galatas_em_grego_e_hebraico(self):
        # NT: "'Gal. 2:16." como nota; AT: "«Dan. 9:24-26." como nota no meio de frase.
        texto, notas = tira_notas("Christ is the end «Dan. 9:24-26. of the law, 'Gal. 2:16. for righteousness.")
        self.assertEqual(notas, ["«Dan. 9:24-26.", "'Gal. 2:16."])
        self.assertEqual(texto, "Christ is the end of the law, for righteousness.")


class LinhasSoDeReferenciaTest(unittest.TestCase):
    def test_linha_so_de_referencia(self):
        self.assertIsNotNone(REF_LINE.match("Dan. 9:24-26."))
        self.assertIsNotNone(REF_LINE.match("Zech. 9:16, 17."))
        self.assertIsNone(REF_LINE.match("Dan 9 was a key to chapter 8, and that the seventy weeks"))

    def test_isso_nao_e_texto_do_livro(self):
        self.assertIsNotNone(BASED_ON.match("This  chapter  is  ba.sed  on  Luke  2:1-20."))
        self.assertIsNone(BASED_ON.match("This chapter shows that the Sabbath is kept."))


if __name__ == "__main__":
    unittest.main()
