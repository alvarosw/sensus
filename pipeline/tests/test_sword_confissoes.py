"""Testes de ingest/sword_confissoes.py: divisão de artigos e provas em OSIS sintético. Precisa do pysword
(ingest/refparse.py); sem ele, o teste é pulado. Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import ingest.sword_confissoes as C  # noqa: E402
except ImportError:  # pysword ausente no python3 do sistema
    C = None


@unittest.skipIf(C is None, "precisa do pysword (python da pipeline)")
class TestConfissoes(unittest.TestCase):
    def test_romano_e_capitulo(self):
        self.assertEqual(C.romano("IX"), 9)
        self.assertEqual(C.romano("XXXIII"), 33)
        self.assertEqual(C.numero_capitulo("Chapter XII"), 12)
        self.assertEqual(C.numero_capitulo("Chapter 12"), 12)

    def test_secoes_romanas_com_provas_saem_do_texto(self):
        osis = ('<title>Chapter I</title><title>Da Escritura</title>\n'
                '<p>I. A luz da natureza<note><reference osisRef="Rom.1.19">Rom. 1,19</reference>; '
                '<reference osisRef="Ps.19.1-Ps.19.3">Ps 19</reference></note> não basta.</p>\n'
                '<p>II. Continuação <note><reference osisRef="Heb.1.1">Heb. 1,1</reference></note>.</p>')
        arts = C.artigos(osis, "cap", 1)
        self.assertEqual([a.rotulo for a in arts], ["ch. 1, sec. 1", "ch. 1, sec. 2"])
        self.assertEqual(arts[0].texto, "A luz da natureza não basta.")
        self.assertEqual(arts[0].refs, [(45001019, 45001019), (19019001, 19019003)])
        self.assertEqual(arts[1].refs, [(58001001, 58001001)])

    def test_paragrafo_sem_rotulo_segue_o_anterior(self):
        osis = ('<p><title>Paragraph 1</title> Texto um.<note><reference osisRef="Gen.1.1">Gen 1:1</reference>'
                '</note></p><p>continua aqui.<note><reference osisRef="John.3.16">John 3:16</reference></note></p>')
        arts = C.artigos(osis, "cap", 2)
        self.assertEqual(len(arts), 1)
        self.assertEqual(arts[0].rotulo, "ch. 2, sec. 1")
        self.assertEqual(arts[0].texto, "Texto um. continua aqui.")
        self.assertEqual(arts[0].refs, [(1001001, 1001001), (43003016, 43003016)])

    def test_no_sem_rotulo_vira_uma_secao_so(self):
        osis = '<title>Chapter 12</title><title>Of Adoption</title><div>Todos os justificados.<note><reference osisRef="Rom.8.15">Rom. 8,15</reference></note></div>'
        arts = C.artigos(osis, "cap", 12)
        self.assertEqual([a.rotulo for a in arts], ["ch. 12, sec. 1"])
        self.assertEqual(arts[0].texto, "Todos os justificados.")

    def test_pergunta_de_catecismo(self):
        osis = ('<p><title>Q. 1. What is the chief end of man?</title>A. Man’s chief end is to glorify God,'
                '<note>[1] <reference osisRef="Rom.11.36">Romans 11:36</reference>.</note> and to enjoy him.</p>'
                '<p><title>Q. 2. What rule?</title>A. The Word.</p>')
        arts = C.artigos(osis, "q")
        self.assertEqual([a.rotulo for a in arts], ["Q. 1", "Q. 2"])
        self.assertEqual(arts[0].texto, "What is the chief end of man? A. Man’s chief end is to glorify God, and to enjoy him.")
        self.assertEqual(arts[0].refs, [(45011036, 45011036)])
        self.assertEqual(arts[1].refs, [])

    def test_referencia_fora_do_canone_conta_como_nao_reconhecida(self):
        osis = '<p>I. Texto.<note><reference osisRef="Matt.3.21">Matt 3:21</reference></note></p>'
        arts = C.artigos(osis, "cap", 1)
        self.assertEqual(arts[0].refs, [])
        self.assertEqual(arts[0].nao_reconhecidas, 1)

    def test_modo_invalido_e_capitulo_obrigatorio(self):
        with self.assertRaises(ValueError):
            C.artigos("<p>I. x</p>", "outro", 1)
        with self.assertRaises(ValueError):
            C.artigos("<p>I. x</p>", "cap")


if __name__ == "__main__":
    unittest.main()
