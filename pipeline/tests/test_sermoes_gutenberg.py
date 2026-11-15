"""Testes de ingest/sermoes_gutenberg.py: sermões por texto de Maclaren (Expositions of Holy Scripture).

Os trechos são do próprio texto do Project Gutenberg (#7069, Gênesis, e #8070, São João), cortados. Precisa do pysword
(ingest/refparse.py); sem ele, o teste é pulado. Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from ingest import sermoes_gutenberg as M  # noqa: E402
    from sensus.refs import vid  # noqa: E402
except ImportError:  # sem pysword
    M = None

# AT: Gênesis xv. 5-18 (pg7069), com a epígrafe e o começo do corpo.
GN15 = """
GOD'S COVENANT WITH ABRAM (Genesis xv. 5-18)


    'And He brought him forth abroad, and said, Look now
    toward heaven, and tell the stars, if thou be able to
    number them: and He said unto him, So shall thy seed be.'
    Euphrates.'--GENESIS xv. 5-18.

1. Abram had exposed himself to dangerous reprisals by his victory over
the confederate Eastern raiders. In the reaction following the
excitement of battle, dread and despondency seem to have shadowed his
soul.
"""

# NT: João iii. 16 (pg8070). O título não tem passagem entre parênteses: a passagem vem da epígrafe.
JO316 = """
THE LAKE AND THE RIVER


'God so loved the world, that He gave His only begotten Son, that
whosoever believeth in Him should not perish, but have everlasting
life.'—JOHN iii. 16.

I venture to say that my text shows us a lake, a river, a pitcher, and
a draught. 'God so loved the world'—that is the lake. A lake makes a
river for itself—'God so loved the world that He _gave_ His… Son.'
"""

START_MARCA = "*** START OF THE PROJECT GUTENBERG EBOOK EXPOSITIONS OF HOLY SCRIPTURE ***"
END_MARCA = "*** END OF THE PROJECT GUTENBERG EBOOK EXPOSITIONS OF HOLY SCRIPTURE ***"


@unittest.skipIf(M is None, "precisa de pysword (ingest/refparse.py)")
class Texto(unittest.TestCase):
    def test_corpo_sai_cabecalho_e_licenca(self):
        bruto = f"Licença longa do Gutenberg\n{START_MARCA}\nCORPO\n{END_MARCA}\nLicença final\n"
        self.assertEqual(M.corpo_do_gutenberg(bruto).strip(), "CORPO")

    def test_paragrafos_juntam_linhas_e_tiram_italico_e_ornamento(self):
        corpo = "uma linha\nde prosa\n\n    * * * * *\n\n_gave_ His\n\n[Illustration: x]\n"
        self.assertEqual(M.paragrafos(corpo), ["uma linha de prosa", "gave His"])

    def test_e_titulo(self):
        self.assertTrue(M.e_titulo("GOD'S COVENANT WITH ABRAM (Genesis xv. 5-18)"))
        self.assertTrue(M.e_titulo("ABRAM AND THE LIFE OF FAITH"))
        self.assertFalse(M.e_titulo("1. Abram had exposed himself to dangerous reprisals."))
        self.assertFalse(M.e_titulo("'Blessed are the meek!'--MATT, v. 5."))  # epígrafe em maiúsculas com cabeçalho
        self.assertFalse(M.e_titulo("I."))

    def test_grupo_nao_vira_sermao_e_epigrafe_sai_do_corpo(self):
        paras = M.paragrafos(GN15)
        grupo = M.paragrafos("ABRAM AND THE LIFE OF FAITH\n\nGOING FORTH (Genesis xii. 5)\n\n'Go.'--GENESIS xii. 1.\n\nTexto.")
        sermoes = M.separa_sermoes(grupo + paras)
        self.assertEqual([s.titulo for s in sermoes], ["GOING FORTH", "GOD'S COVENANT WITH ABRAM"])
        self.assertEqual(sermoes[1].parentese, "Genesis xv. 5-18")
        self.assertEqual(sermoes[1].paragrafos[0][:20], "1. Abram had exposed")
        self.assertEqual(len(sermoes[1].paragrafos), 1)
        self.assertTrue(sermoes[1].epigrafe.endswith("--GENESIS xv. 5-18."))


@unittest.skipIf(M is None, "precisa de pysword (ingest/refparse.py)")
class Passagem(unittest.TestCase):
    def sermao(self, texto):
        return M.separa_sermoes(M.paragrafos(texto))[0]

    def test_at_pelo_parentese_do_titulo(self):
        s = self.sermao(GN15)
        self.assertEqual(M.passagem(s), ((vid(1, 15, 5), vid(1, 15, 18)), None))

    def test_nt_pelo_cabecalho_da_epigrafe(self):
        s = self.sermao(JO316)
        self.assertEqual(s.cabecalho, "JOHN iii. 16")
        self.assertEqual(M.passagem(s), ((vid(43, 3, 16), vid(43, 3, 16)), None))
        self.assertTrue(s.paragrafos[0].startswith("I venture to say"))

    def test_motivos_de_descarte(self):
        sem = M.Sermao("TITULO SEM PASSAGEM", None, None, None, ["texto"])
        self.assertEqual(M.passagem(sem), (None, "sem_cabecalho"))
        ilegivel = M.Sermao("TITULO", "Introduction", None, "GALATIANS vi. 25", ["texto"])
        self.assertEqual(M.passagem(ilegivel), (None, "cabecalho_ilegivel"))

    def test_epigrafe_com_versao_e_ocr(self):
        texto = "TITULO\n\n'Corpo da citação.'--GALATIANS iv. 4, 5 (R.V.).\n\nProsa."
        s = self.sermao(texto)
        self.assertEqual(s.cabecalho, "GALATIANS iv. 4, 5")
        self.assertEqual(M.passagem(s), ((vid(48, 4, 4), vid(48, 4, 5)), None))


@unittest.skipIf(M is None, "precisa de pysword (ingest/refparse.py)")
class Volume(unittest.TestCase):
    def test_linhas_do_volume_formato_e_contagem(self):
        texto = "\n".join([
            START_MARCA, "", "EXPOSITIONS OF HOLY SCRIPTURE", "", "ABRAM AND THE LIFE OF FAITH", "",
            GN15.strip(), "", "THE BOOK OF JOSHUA", "", "Prosa curta da seção.", "",
            "SEM CABECALHO", "", "Prosa solta.", "", "Mais prosa.", "",
            "TITULO ILEGIVEL", "", "'Citação.'--GAL. vi. 25.", "", "Corpo.", "",
            "THE LAKE AND THE RIVER", "", JO316.split("\n\n", 1)[1].strip(), "", END_MARCA,
        ])
        linhas, stats = M.linhas_do_volume(texto, "Teste")
        self.assertEqual(len(linhas), 2)
        (s1, e1, t1), (s2, e2, t2) = linhas
        self.assertEqual((s1, e1), (vid(1, 15, 5), vid(1, 15, 18)))
        self.assertEqual((s2, e2), (vid(43, 3, 16), vid(43, 3, 16)))
        self.assertTrue(t1.startswith("Maclaren — Teste: GOD'S COVENANT WITH ABRAM\n\n1. Abram had exposed"))
        self.assertTrue(t2.startswith("Maclaren — Teste: THE LAKE AND THE RIVER\n\nI venture to say"))
        self.assertNotIn("'And He brought", t1)  # epígrafe fora do comentário
        self.assertEqual(stats["mantidos"], 2)
        self.assertEqual(stats["cabecalho_ilegivel"], 1)
        self.assertEqual(stats["sem_cabecalho"], 1)  # "SEM CABECALHO" com prosa, sem passagem
        self.assertEqual(stats["secao"], 1)  # "THE BOOK OF JOSHUA": título sem passagem e com um parágrafo só


if __name__ == "__main__":
    unittest.main()
