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


if __name__ == "__main__":
    unittest.main()
