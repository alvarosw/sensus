"""Testes de sensus/descricoes_pt.py (descrições em português por regra) e de ingest/descricoes_pt.py (TSV e chaves).

Regra nova = caso de AT hebraico e de NT grego. Casos: Arão (AT, Êxodo 4:14; é o exemplo do modelo da TIPNR) e
Bartimeu (NT, Marcos 10:46, com nome grego). Os nomes pt usados aqui são de teste (vêm de entity_name no pipeline).
Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import hashlib
import sys
import unittest
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "ingest"))

from sensus.descricoes_pt import SECOES, ler_glossario, ref_pt, traduz_descricao, traduz_paragrafo  # noqa: E402
import descricoes_pt as ingestor  # noqa: E402

GLOSSARIO = (PIPELINE / "ingest" / "corrections" / "glossario-descricoes.tsv").read_text(encoding="utf-8")
GLOS = ler_glossario(GLOSSARIO)

# AT (hebraico): Êxodo 4:14, o modelo da TIPNR com todas as relações.
ARAO = ("A high priest from the tribe of Levi living at the time of Egypt and Wilderness, first mentioned at Exo.4.14)"
        "\n\nreferred to as Aaron (אַהֲרֹן), or Aaron (Ἀαρών);\n\nson of Amram and Jochebed;\n\na brother of Moses "
        "and Miriam;\n\nhusband of Elisheba;\n\nfather of Nadab, Abihu, Eleazar and Ithamar.")
NOMES_ARAO = {"Aaron": "Arão", "Amram": "Anrão", "Jochebed": "Joquebede", "Moses": "Moisés", "Miriam": "Miriã",
              "Elisheba": "Eliseba", "Nadab": "Nadabe", "Abihu": "Abiú", "Eleazar": "Eleazar", "Ithamar": "Itamar"}

# NT (grego): Marcos 10:46, nome grego 'Βαρτιμαῖος' e relação 'a son of'.
BARTIMEU = ("A man living at the time of the New Testament, only mentioned at Mrk.10.46)\n\nonly referred to as "
            "Bartimaeus (Βαρτιμαῖος);\n\na son of Timaeus.")


class ModeloTest(unittest.TestCase):
    def test_at_com_todas_as_linhas(self):
        self.assertEqual(
            traduz_descricao(ARAO, GLOS, NOMES_ARAO),
            "Sumo sacerdote da tribo de Levi, da época do Egito e do deserto; primeira menção em Êx 4:14.\n\n"
            "Chamado de Arão (אַהֲרֹן) ou Arão (Ἀαρών);\n\nfilho de Anrão e Joquebede;\n\nirmão de Moisés e Miriã;"
            "\n\nmarido de Eliseba;\n\npai de Nadabe, Abiú, Eleazar e Itamar.",
        )

    def test_nt_grego_so_aparece(self):
        self.assertEqual(
            traduz_descricao(BARTIMEU, GLOS, {"Timaeus": "Timeu"}),
            "Homem da época do Novo Testamento; só aparece em Mc 10:46.\n\n"
            "Chamado apenas de Bartimaeus (Βαρτιμαῖος);\n\nfilho de Timeu.",
        )

    def test_nome_sem_pt_fica_em_ingles(self):
        self.assertIn("filho de Timaeus.", traduz_descricao(BARTIMEU, GLOS, {}))

    def test_local_com_perto_de(self):
        t = traduz_descricao("A location near Abel-meholah only mentioned at Jdg.7.22)", GLOS, {})
        self.assertEqual(t, "Lugar perto de Abel-meholah; só aparece em Jz 7:22.")

    def test_territorio_de_tribo_com_perto_de(self):
        t = traduz_paragrafo("A location in Judah Tribe near Tekoa only mentioned at 1Ki.9.1)", GLOS, {"Tekoa": "Tecoa"})
        self.assertEqual(t, "Lugar no território da tribo de Judá, perto de Tecoa; só aparece em 1Rs 9:1.")

    def test_sem_tempo_nao_tem_virgula(self):
        self.assertEqual(traduz_paragrafo("A location in Asia first mentioned at Gen.13.2)", GLOS, {}),
                         "Lugar na Ásia; primeira menção em Gn 13:2.")

    def test_tudo_ou_nada(self):
        # Um parágrafo fora da gramática (cargo 'deity in the Old Testament', com 'called') zera a descrição.
        self.assertIsNone(traduz_descricao("A male deity in the Old Testament; called Nebo (נְבוֹ)", GLOS, {}))
        self.assertIsNone(traduz_descricao(ARAO + "\n\nnunca visto antes.", GLOS, NOMES_ARAO))

    def test_tempo_fora_do_glossario_nao_traduz(self):
        self.assertIsNone(traduz_paragrafo("A man living at the time of Nothing, only mentioned at Gen.1.1)", GLOS, {}))

    def test_expressao_comum_nao_vira_nome(self):
        # 'of the Kingdom of Israel' não é nome próprio: o parágrafo não é traduzido (nada de inglês no meio).
        self.assertIsNone(traduz_paragrafo("A man of the Kingdom of Israel living at the time of Divided Monarchy, "
                                           "first mentioned at 1Ki.14.1)", GLOS, {}))

    def test_tribo_com_duvida_da_fonte(self):
        t = traduz_paragrafo("A man from the tribe of Judah(?) living at the time of Divided Monarchy, only mentioned "
                             "at 1Ch.4.17)", GLOS, {})
        self.assertEqual(t, "Homem da tribo de Judá(?), da época da monarquia dividida; só aparece em 1Cr 4:17.")

    def test_intervalo_de_versiculos_nao_traduz(self):
        self.assertIsNone(traduz_paragrafo("A location first mentioned at Gen.46.10-Exo)", GLOS, {}))

    def test_vazio(self):
        self.assertIsNone(traduz_descricao("  ", GLOS, {}))


class ReferenciaTest(unittest.TestCase):
    def test_abreviacoes_do_app(self):
        self.assertEqual(ref_pt("Exo.4.14"), "Êx 4:14")
        self.assertEqual(ref_pt("Psa.120.5"), "Sl 120:5")
        self.assertEqual(ref_pt("1Ch.11.35"), "1Cr 11:35")
        self.assertEqual(ref_pt("Gen.10.13a"), "Gn 10:13a")

    def test_fora_do_padrao(self):
        self.assertIsNone(ref_pt("Gen.46.10-Exo"))
        self.assertIsNone(ref_pt("Xyz.1.1"))


class GlossarioTest(unittest.TestCase):
    def test_secoes_do_glossario_real(self):
        self.assertEqual(set(GLOS), set(SECOES))
        self.assertEqual(GLOS["tribo"]["Levi"], "Levi")
        self.assertEqual(GLOS["cargo"]["high priest"], "sumo sacerdote")

    def test_secao_invalida(self):
        with self.assertRaisesRegex(ValueError, "linha 2"):
            ler_glossario("secao\tingles\tportugues\tnota\nfoo\tman\thomem\t")

    def test_termo_repetido_na_secao(self):
        with self.assertRaisesRegex(ValueError, "repetido"):
            ler_glossario("cargo\tman\thomem\ncargo\tman\tmulher\n")

    def test_comentario_e_cabecalho_ignorados(self):
        g = ler_glossario("# comentário\nsecao\tingles\tportugues\tnota\ncargo\tman\thomem\t\n")
        self.assertEqual(g["cargo"], {"man": "homem"})


class ChaveETextoTest(unittest.TestCase):
    def test_chave_e_sha1_do_texto_exato(self):
        texto = "A king of Judah\n\nson of Ahaz."
        esperado = hashlib.sha1(texto.encode("utf-8")).hexdigest()[:16]
        self.assertEqual(ingestor.chave_da_descricao(texto), esperado)
        self.assertNotEqual(ingestor.chave_da_descricao(texto + " "), esperado)

    def test_decodifica_quebra_e_barra(self):
        self.assertEqual(ingestor.decodifica(r"um\n\ndois \\ tres"), "um\n\ndois \\ tres")

    def test_tsv_revisado_e_sem(self):
        chave = "0123456789abcdef"
        tsv = ("chave\tfonte\tdescricao_pt\torigem\tnota\n"
               f"{chave}\ttheographic\tUm rei.\\nSegunda linha.\trevisado\trev. IA\n"
               "fedcba9876543210\topenbible-geo\t\tsem\t\n")
        r = ingestor.ler_tsv(tsv)
        self.assertEqual(r[chave]["descricao_pt"], "Um rei.\nSegunda linha.")
        self.assertEqual(r["fedcba9876543210"]["origem"], "sem")

    def test_tsv_erros(self):
        cab = "chave\tfonte\tdescricao_pt\torigem\tnota\n"
        ruim = {
            "origem": cab + "0123456789abcdef\ttheographic\tx\trascunho\t\n",
            "chave": cab + "abc\ttheographic\tx\trevisado\t\n",
            "repetida": cab + "0123456789abcdef\ttheographic\tx\trevisado\t\n"
                              "0123456789abcdef\ttheographic\ty\trevisado\t\n",
            "cabecalho": "chave\tfonte\tdescricao\torigem\tnota\n",
        }
        for nome, texto in ruim.items():
            with self.subTest(nome):
                with self.assertRaises(ValueError):
                    ingestor.ler_tsv(texto)

    def test_tsv_versionado_e_valido(self):
        # O arquivo versionado é lido sem erro e toda linha revisada tem texto pt.
        linhas = ingestor.ler_tsv((ingestor.CORRECOES / "descricoes-pt.tsv").read_text(encoding="utf-8"))
        self.assertTrue(linhas)
        self.assertTrue(all(r["descricao_pt"].strip() for r in linhas.values() if r["origem"] == "revisado"))


if __name__ == "__main__":
    unittest.main()
