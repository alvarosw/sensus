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
    BASED_ON, CHAPTER_HEAD, REF_LINE, SECTION_HEAD, e_citacao_biblica, e_citacao_por_quadros, palavras_do_texto, quadros, next_chapter, roman_value, tira_notas, to_roman,
)



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
    def test_titulo_com_versiculos_e_reconhecido_para_sair(self):
        # Sai do texto; não liga versículo (seções largas demais, ver adventist_pd.build_work).
        self.assertIsNotNone(SECTION_HEAD.search("THE HISTORY OF GREECE (Chapter 11: 3-13)"))
        self.assertIsNotNone(SECTION_HEAD.search("THE HISTORY OF THE DECREES (Chapter 11:1, 2)"))

    def test_titulo_so_de_capitulo_nao_e_secao(self):
        # "(Chapter 5)" não diz versículo: não liga parágrafo nenhum.
        self.assertIsNone(SECTION_HEAD.search("THE HANDWRITING ON THE WALL (Chapter 5)"))


# Versículos da KJV (texto completo), para a palavra da Escritura nas citações de margem.
NEH_13_10_13 = (
    "And I perceived that the portions of the Levites had not been given them: for the Levites and the singers, "
    "that did the work, were fled every one to his field. Then contended I with the rulers, and said, Why is the "
    "house of God forsaken? And I gathered them together, and set them in their place. Then brought all Judah the "
    "tithe of the corn and the new wine and the oil unto the treasuries. And I made treasurers over the treasuries, "
    "Shelemiah the priest, and Zadok the scribe, and of the Levites, Pedaiah: and next to them was Hanan the son of "
    "Zaccur, the son of Mattaniah: for they were counted faithful, and their office was to distribute unto their "
    "brethren.")
EZRA_9_2 = (
    "For they have taken of their daughters for themselves, and for their sons: so that the holy seed have mingled "
    "themselves with the people of those lands: yea, the hand of the princes and rulers hath been chief in this "
    "trespass.")


class CitacaoDeMargemTest(unittest.TestCase):
    def test_citacao_so_da_escritura_sai(self):
        # Margem de Haskell (Daniel 1901): "... treasuries, Neh. 13; 10-13." sem comentário nenhum.
        texto = ("And I perceived that the portions of the Levites had not been given them; then brought all Judah "
                 "the tithe of the corn and the new wine and the oil unto the treasuries, Neh. 13; 10-13.")
        self.assertTrue(e_citacao_biblica(texto, palavras_do_texto(NEH_13_10_13)))

    def test_citacao_de_margem_do_at(self):
        texto = ("the holy seed have mingled themselves with the people of those lands: yea, the hand of the princes "
                 "and rulers hath been chief in this trespass, Ezra 9:1, 2.")
        self.assertTrue(e_citacao_biblica(texto, palavras_do_texto(EZRA_9_2)))

    def test_comentario_com_citacao_no_meio_fica(self):
        # Prosa do autor com a referência: as palavras fora da Escritura passam do limite, e o parágrafo fica.
        texto = ("The Lord shows us here that the sanctuary of the Levites was neglected, and the reformation of "
                 "that day was a type of the cleansing of the sanctuary in our time. Neh. 13; 10-13.")
        self.assertFalse(e_citacao_biblica(texto, palavras_do_texto(NEH_13_10_13)))

    def test_sem_versiculo_nao_e_citacao(self):
        self.assertFalse(e_citacao_biblica("portions of the Levites had not been given them", set()))



DANIEL_5_23 = (
    "But hast lifted up thyself against the Lord of heaven; and they have brought the vessels of his house before "
    "thee, and thou, and thy lords, thy wives, and thy concubines, have drunk wine in them; and thou hast praised the "
    "gods of silver, and gold, of brass, iron, wood, and stone, which see not, nor hear, nor know: and the God in "
    "whose hand thy breath is, and whose are all thy ways, hast thou not glorified:")


def _quadros_de(texto):
    return {hash(q) for q in quadros(palavras_do_texto(texto))}


class CitacaoPorQuadrosTest(unittest.TestCase):
    def test_citacao_sem_referencia_propria_sai(self):
        # Margem com erro de OCR numa palavra ("lifed" por "lifted"): continua sendo a Escritura.
        texto = DANIEL_5_23.replace("lifted", "lifed")
        self.assertTrue(e_citacao_por_quadros(palavras_do_texto(texto), _quadros_de(DANIEL_5_23)))

    def test_comentario_fica(self):
        texto = ("This scene shows that the proud king had despised the lessons of his father, and that heaven "
                 "keeps a record of every act of pride.")
        self.assertFalse(e_citacao_por_quadros(palavras_do_texto(texto), _quadros_de(DANIEL_5_23)))


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
