"""Testes de ingest/doutrina_pd.py: cabeçalhos de parte, capítulo e seção; parágrafos com referência; prefácio, sumário
e índice fora do banco.

Os trechos são do Project Gutenberg de A. H. Strong, Systematic Theology (#44035, #44555, #45283), cortados e com o
texto real. Precisa do pysword (ingest/refparse.py); sem ele, o teste é pulado. Rodar a partir da pasta pipeline:
python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from ingest import doutrina_pd as D  # noqa: E402
    from sensus.refs import vid  # noqa: E402
except ImportError:  # sem pysword
    D = None

# Corpo de um volume: prefácio (com uma referência que não entra), capítulos, parágrafos com AT e NT, e o índice.
VOLUME = """*** START OF THE PROJECT GUTENBERG EBOOK SYSTEMATIC THEOLOGY (VOLUME 1 OF 3) ***

Preface. The author hopes that Ps. 19:1 will be read with care.

PART I. PROLEGOMENA.

Chapter I. Idea Of Theology.

I. Definition of Theology.

Theology is the science of God and of the relations between God and the universe (Ps. 19:1; see Rom. 8:30.)

Plain paragraph without any scripture reference at all.

Chapter II. Material of Theology.

    The Spirit gives life (Rom. 8:30—“whom he called”), and in 1 Pet. 4:6 the dead are judged.

Index Of Authors.

Junk paragraph with Gen. 1:1 that must not enter.

*** END OF THE PROJECT GUTENBERG EBOOK SYSTEMATIC THEOLOGY (VOLUME 1 OF 3) ***
"""

def par(b, c, v):
    return (vid(b, c, v), vid(b, c, v))


if D is not None:
    OBRA = D.Obra(
        source_id="teste",
        title="Systematic Theology",
        short="Systematic Theology",
        author="Augustus Hopkins Strong (1836-1921)",
        edition="The Judson Press, 1907",
        url="https://www.gutenberg.org/ebooks/44035",
        rights="Project Gutenberg eBook #44035",
        pd="Domínio público (teste).",
        tradition="baptist",
        volumes=(D.Volume(44035, "vol. 1", r"^Index Of"),),
    )


@unittest.skipIf(D is None, "precisa de pysword (ingest/refparse.py)")
class Cabecalhos(unittest.TestCase):
    def test_parte_capitulo_e_secao(self):
        self.assertEqual(D.cabecalho(["PART I. PROLEGOMENA."]), ("parte", "Part I"))
        self.assertEqual(D.cabecalho(["Chapter I. Idea Of Theology."]), ("capitulo", "Chapter I"))
        self.assertEqual(D.cabecalho(["Section I.—Creation."]), ("secao", "Section I"))
        self.assertEqual(D.cabecalho(["BOOK IV.", "ON THE EXTERNAL MEANS OR AIDS"]), ("parte", "Book IV"))

    def test_prosa_que_comeca_como_cabecalho_nao_e_cabecalho(self):
        self.assertIsNone(D.cabecalho(["Chapter II shows that the doctrine is taught."]))

    def test_sumario_nao_muda_o_capitulo(self):
        # Sumário: um bloco com vários cabeçalhos ("Part I..." e "   Chapter I..." logo abaixo).
        self.assertIsNone(D.cabecalho(["Part I. Prolegomena.", "   Chapter I. Idea Of Theology."]))


@unittest.skipIf(D is None, "precisa de pysword (ingest/refparse.py)")
class Linhas(unittest.TestCase):
    def setUp(self):
        self.rows, self.stats = D.linhas_da_obra([(OBRA.volumes[0], VOLUME)], OBRA)

    def test_referencias_de_at_e_nt_com_cabecalho_de_parte_e_capitulo(self):
        cites = [(s, e) for s, e, _ in self.rows]
        # AT: Ps 19:1 (capítulo I). NT: Rom 8:30 (duas vezes, em capítulos diferentes) e 1 Pe 4:6.
        self.assertEqual(cites, [
            (vid(19, 19, 1), vid(19, 19, 1)),
            (vid(45, 8, 30), vid(45, 8, 30)),
            (vid(45, 8, 30), vid(45, 8, 30)),
            (vid(60, 4, 6), vid(60, 4, 6)),
        ])

    def test_texto_comeca_com_autor_obra_parte_e_capitulo(self):
        heads = [t.split("\n\n", 1)[0] for _, _, t in self.rows]
        self.assertEqual(heads[0], "Augustus Hopkins Strong (1836-1921) — Systematic Theology, Part I, Chapter I")
        self.assertEqual(heads[2], "Augustus Hopkins Strong (1836-1921) — Systematic Theology, Part I, Chapter II")
        self.assertTrue(self.rows[0][2].endswith("(Ps. 19:1; see Rom. 8:30.)"))

    def test_prefacio_sumario_e_indice_ficam_fora(self):
        textos = " ".join(t for _, _, t in self.rows)
        self.assertNotIn("Preface", textos)
        self.assertNotIn("Junk paragraph", textos)
        self.assertNotIn("Plain paragraph", textos)  # sem referência: sai, com contagem

    def test_contagens(self):
        self.assertEqual(self.stats["prefácio e sumário (fora)"], 1)
        self.assertEqual(self.stats["cabeçalhos"], 3)
        self.assertEqual(self.stats["com referência"], 2)
        self.assertEqual(self.stats["sem referência"], 2)  # "I. Definition..." e "Plain paragraph..."
        self.assertEqual(self.stats["referências"], 4)


# Calvino (Institutas, trad. John Allen): notas de rodapé e marcas no texto, como o Gutenberg traz (cortado).
CALVINO_VOL1 = """*** START OF THE PROJECT GUTENBERG EBOOK INSTITUTES (VOL. 1 OF 2) ***

BOOK I. ON THE KNOWLEDGE OF GOD THE CREATOR.

Chapter I. The Connection Between The Knowledge Of God And The Knowledge Of Ourselves.

The Psalmist(2) speaks of God, and in another place Christ says, John vii. 18. viii. 50, as I have shown.

I. This is a section number without a book, Gen. ii., and no scripture here.

FOOTNOTES

    1 It is not uncommon to represent the leading principles of Calvin.

    2 Prov. xxix. 18.

   13 Heb. ii. 3, 4.
      Continued note text with no reference.

*** END OF THE PROJECT GUTENBERG EBOOK INSTITUTES (VOL. 1 OF 2) ***
"""

CALVINO_VOL2 = """BOOK IV.
ON THE EXTERNAL MEANS.

CHAPTER I.

The true church is the mother of all the pious.[1404]

END OF THE INSTITUTES.

Footnote 1404:

  Gal. v. 1.

Footnote 1405:

  1 Cor. vii. 21.

*** END OF THE PROJECT GUTENBERG EBOOK INSTITUTES (VOL. 2 OF 2) ***
"""


@unittest.skipIf(D is None, "precisa de pysword (ingest/refparse.py)")
class NotasDeCalvino(unittest.TestCase):
    def setUp(self):
        self.v1 = D.Volume(45001, "vol. 1", r"^FOOTNOTES\s*$", marca=r"\((\d{1,4})\)", notas="linha")
        self.v2 = D.Volume(64392, "vol. 2", r"^END OF THE INSTITUTES\.", marca=r"\[(\d{1,4})\]", notas="bloco")
        self.obra = D.OBRAS["calvin-institutes"]

    def test_notas_formato_linha_e_bloco(self):
        # Volume 1: nota 2 tem referência de capítulo romano; a 1 não tem; a 13 traz duas (continuação não conta).
        n1 = D.notas_do_volume(CALVINO_VOL1, self.v1, romano=True)
        self.assertEqual(n1, {2: [par(20, 29, 18)], 13: [par(58, 2, 3), par(58, 2, 4)]})
        # Volume 2: notas depois de "END OF THE INSTITUTES.", formato "Footnote N:".
        n2 = D.notas_do_volume(CALVINO_VOL2, self.v2, romano=True)
        self.assertEqual(n2, {1404: [par(48, 5, 1)], 1405: [par(46, 7, 21)]})

    def test_marca_liga_a_nota_ao_paragrafo_e_sai_do_texto(self):
        texto, usadas = D.tira_marcas("The Psalmist(2) speaks of God(9).", self.v1, {2: []})
        self.assertEqual(usadas, [2])
        self.assertEqual(texto, "The Psalmist speaks of God(9).")  # marca sem nota fica

    def test_nota_no_corpo_do_volume_2_nao_vira_paragrafo(self):
        # No Gutenberg do volume 2, a nota "Footnote N:" vem no corpo, depois do capítulo: liga pela marca e sai do texto.
        texto = ("BOOK IV.\n\nCHAPTER I.\n\nThe church is the mother[1].\n\nFootnote 1:\n\n  Rom. viii. 30.\n\n"
                 "Further prose with John vii. 18.\n\nEND OF THE INSTITUTES.\n\nFootnote 2:\n\n  Gal. v. 1.\n")
        rows, stats = D.linhas_da_obra([(self.v2, texto)], self.obra)
        self.assertEqual([(s, e) for s, e, _ in rows], [(vid(45, 8, 30), vid(45, 8, 30)), (vid(43, 7, 18), vid(43, 7, 18))])
        self.assertFalse(any("Footnote" in t or "Rom. viii. 30." == t.split("\n\n", 1)[1] for _, _, t in rows))
        self.assertEqual(stats["parágrafos"], 2)

    def test_paragrafo_com_marca_e_referencias_de_romanos(self):
        rows, stats = D.linhas_da_obra([(self.v1, CALVINO_VOL1)], self.obra)
        self.assertEqual([(s, e) for s, e, _ in rows], [
            (vid(43, 7, 18), vid(43, 7, 18)),  # "John vii. 18" no próprio texto
            (vid(43, 8, 50), vid(43, 8, 50)),  # "viii. 50", continuação com ponto
            (vid(20, 29, 18), vid(20, 29, 18)),  # nota 2, ligada pela marca "(2)" (depois das do texto)
        ])
        for _, _, texto in rows:
            self.assertTrue(texto.startswith("John Calvin (1509-1564) — Institutes of the Christian Religion, "
                                             "Book I, Chapter I\n\nThe Psalmist speaks of God"), texto[:120])
        self.assertNotIn("(2)", rows[0][2])  # a marca sai do texto
        self.assertEqual(stats["marcas de nota ligadas"], 1)
        self.assertEqual(stats["sem referência"], 1)  # "I. This is a section number..." (sem livro)


if __name__ == "__main__":
    unittest.main()
