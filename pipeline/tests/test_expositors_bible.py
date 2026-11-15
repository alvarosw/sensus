"""Testes de ingest/sermoes_gutenberg.py para The Expositor's Bible (capítulos por passagem).

Os trechos são do próprio texto do Project Gutenberg, cortados: Josué (eBook #42319, AT, cabeçalho com a passagem
solta) e 1 Coríntios (#42354, NT, epígrafe que vem antes do número do capítulo). Precisa do pysword
(ingest/refparse.py); sem ele, o teste é pulado. Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from ingest import sermoes_gutenberg as M  # noqa: E402
except ImportError:  # sem pysword
    M = None

# AT: Josué i. 2 (pg42319). O capítulo III abre com título e a passagem numa linha só.
JOSUE_III = """
CHAPTER III.

_A SUCCESSOR TO MOSES._

JOSHUA i. 2.


There are some men to whom it is almost impossible to find successors.
Men of imperial mould; Nature's primates, head and shoulders above their fellows.
"""

# AT: capítulo sem passagem (introdução) e capítulo de salmo (pg42445): o número do salmo é a passagem.
SEM_PASSAGEM = """
CHAPTER I.

_INTRODUCTORY: THE BOOK OF JOSHUA._


With a purely historical book like Joshua before us, it is of importance to keep in view two ways of regarding
Old Testament history, in accordance with one or other of which any exposition of such a book must be framed.

According to one of these views, the historical books of Scripture have for their main object not to tell the
story of the Hebrew nation, but to teach the ways of God with men.
"""

SALMO_I = """
                                PSALM I.

1 Happy the man who has not walked in the counsel of the wicked, And has not stood in the way of sinners.

The Psalter may be regarded as the heart's echo to the speech of God, the manifold music of its wind-swept strings.
"""

# NT: 1 Coríntios (pg42354). A epígrafe da seção II vem ANTES de "II.", e o título volta depois do número.
CORINTIOS = """
_INTRODUCTION._

"After these things Paul departed from Athens, and came to Corinth; and found a certain Jew named Aquila."--ACTS
xviii. 1-3.

I.

_INTRODUCTION._

Corinth was the first Gentile city in which Paul spent any considerable time.

"Paul, called to be an apostle of Jesus Christ through the will of God, and Sosthenes our brother, unto the church
of God which is at Corinth."--1 COR. i. 2-9.

II.

_THE CHURCH IN CORINTH._

In the year 58 A.D., when Paul wrote this Epistle, Corinth was a city with a mixed population.
"""


@unittest.skipIf(M is None, "precisa de pysword (ingest/refparse.py)")
class Capitulos(unittest.TestCase):
    def test_at_passagem_solta_e_titulo(self):
        linhas, stats = M.linhas_de_capitulos(JOSUE_III, "Joshua", "William Garden Blaikie")
        self.assertEqual(stats["capitulos"], 1)
        self.assertEqual(len(linhas), 1)
        inicio, fim, texto = linhas[0]
        self.assertEqual((inicio, fim), (6001002, 6001002))  # Josué 1:2
        self.assertTrue(texto.startswith(
            "The Expositor's Bible — Joshua (William Garden Blaikie): A SUCCESSOR TO MOSES\n\n"
            "There are some men"))
        self.assertNotIn("JOSHUA i. 2", texto)  # a passagem é cabeçalho, não texto

    def test_nt_epigrafe_antes_do_numero(self):
        linhas, stats = M.linhas_de_capitulos(CORINTIOS, "1 Corinthians", "Marcus Dods")
        self.assertEqual(stats["capitulos"], 2)
        self.assertEqual(stats["mantidos"], 2)
        por_inicio = {inicio: (fim, texto) for inicio, fim, texto in linhas}
        # Introdução: a epígrafe de Atos 18 (antes do "I.") é a passagem.
        self.assertEqual(por_inicio[44018001][0], 44018003)
        self.assertTrue(por_inicio[44018001][1].startswith(
            "The Expositor's Bible — 1 Corinthians (Marcus Dods): INTRODUCTION\n\nCorinth was"))
        # Capítulo II: 1 Coríntios 1:2-9, título sem repetir no corpo, epígrafe fora do texto.
        self.assertEqual(por_inicio[46001002][0], 46001009)
        texto = por_inicio[46001002][1]
        self.assertTrue(texto.startswith(
            "The Expositor's Bible — 1 Corinthians (Marcus Dods): THE CHURCH IN CORINTH\n\nIn the year 58"))
        self.assertNotIn("Paul, called", texto)

    def test_sem_passagem_descarta_com_motivo(self):
        linhas, stats = M.linhas_de_capitulos(SEM_PASSAGEM, "Joshua", "William Garden Blaikie")
        self.assertEqual(linhas, [])
        self.assertEqual(stats["sem_cabecalho"], 1)
        self.assertEqual(stats["mantidos"], 0)

    def test_salmo_usa_o_numero_do_salmo_como_passagem(self):
        linhas, _ = M.linhas_de_capitulos(SALMO_I, "Psalms, vol. 1", "Alexander Maclaren")
        self.assertEqual(len(linhas), 1)
        self.assertEqual((linhas[0][0], linhas[0][1]), (19001001, 19001006))  # Salmo 1 inteiro
        self.assertIn("The Expositor's Bible — Psalms, vol. 1 (Alexander Maclaren)", linhas[0][2])

    def test_linha_de_passagem_tira_subtitulo_e_parentese(self):
        self.assertTrue(M._passagem_solta("ISAIAH i.--HIS GENERAL PREFACE."))
        self.assertEqual(M._passagem_da_linha("ISAIAH i.--HIS GENERAL PREFACE."), "ISAIAH i.")
        self.assertEqual(M._passagem_da_linha("ISAIAH ii. (740-735 B.C.)."), "ISAIAH ii.")
        self.assertFalse(M._passagem_solta("THE CHURCH IN CORINTH."))

    def test_volumes_do_registro(self):
        # 49 volumes do catálogo (sem o Índice, eBook #39819). Todos os autores morreram até 1955: nenhum descartado.
        self.assertEqual(len(M.EXPOSITORS.volumes), 49)
        self.assertTrue(all(v.morte <= M.LIMITE_MORTE for v in M.EXPOSITORS.volumes))
        self.assertGreater(1956, M.LIMITE_MORTE)


if __name__ == "__main__":
    unittest.main()
