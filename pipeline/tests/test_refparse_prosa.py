"""Testes de ingest/refparse.py na prosa: capítulo romano em linha (find_refs romano=True) e a varredura que não
perde a referência depois de uma palavra que não é livro ("In 1 Pet. 4:6", "Contrast 2 Tim. 3:2").

Os trechos são de Calvino (Institutas, trad. John Allen; notas de rodapé) e de Strong (Systematic Theology), no
formato em que o Project Gutenberg traz. Precisa do pysword (ingest/refparse.py); sem ele, o teste é pulado. Rodar a
partir da pasta pipeline: python3 -m unittest discover tests
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


def par(b, c, v):
    return (vid(b, c, v), vid(b, c, v))


@unittest.skipIf(R is None, "precisa de pysword (ingest/refparse.py)")
class ProsaRomana(unittest.TestCase):
    def test_at_capitulo_romano_com_versiculo(self):
        # AT, notas de Calvino: "Prov. xxix. 18."; "Dan. ii. 34. Isaiah xi. 4. Psalm ii. 9."
        self.assertEqual(R.find_refs("Prov. xxix. 18.", romano=True), [par(20, 29, 18)])
        self.assertEqual(
            R.find_refs("Dan. ii. 34. Isaiah xi. 4. Psalm ii. 9.", romano=True),
            [par(27, 2, 34), par(23, 11, 4), par(19, 2, 9)])
        self.assertEqual(R.find_refs("Jer. ii. 13.", romano=True), [par(24, 2, 13)])

    def test_nt_capitulo_romano_e_continuacoes(self):
        # NT: "Rom. viii. 32."; "John vii. 18. viii. 50." (dois capítulos, com ponto); "1 Cor. xv. 3, 17." (lista)
        self.assertEqual(R.find_refs("Rom. viii. 32.", romano=True), [par(45, 8, 32)])
        self.assertEqual(R.find_refs("John vii. 18. viii. 50.", romano=True), [par(43, 7, 18), par(43, 8, 50)])
        self.assertEqual(R.find_refs("1 Cor. xv. 3, 17.", romano=True), [par(46, 15, 3), par(46, 15, 17)])
        self.assertEqual(R.find_refs("Heb. ii. 3, 4.", romano=True), [par(58, 2, 3), par(58, 2, 4)])
        self.assertEqual(R.find_refs("Matt. xxiv. 24.", romano=True), [par(40, 24, 24)])

    def test_capitulo_arabico_continua_valendo_com_romano(self):
        # Em prosa de Calvino, "Gen. v. 3" é Gênesis 5:3, e "Rom 8:28" segue com dois pontos.
        self.assertEqual(R.find_refs("Gen. v. 3", romano=True), [par(1, 5, 3)])
        self.assertEqual(R.find_refs("Rom 8:28; 12:1, 2", romano=True),
                         [par(45, 8, 28), par(45, 12, 1), par(45, 12, 2)])

    def test_romano_nao_vira_referencia_sem_versiculo_ou_secao(self):
        # "Rom. viii." sozinho (fim de frase), "I." de seção, "v." como versículo e maiúsculas não são referência.
        self.assertEqual(R.find_refs("as in Rom. viii.", romano=True), [])
        self.assertEqual(R.find_refs("I. Therefore the same Psalmist adduced a verse", romano=True), [])
        self.assertEqual(R.find_refs("Rom. VIII. 30", romano=True), [])
        self.assertEqual(R.find_refs("Rom. viii. v. 30", romano=True), [])
        self.assertEqual(R.find_refs("Trip. Hist. lib. 8. c. 1. Acat. in lib. 11. cap. 16.", romano=True), [])

    def test_v_nao_e_capitulo_em_continuacao(self):
        # "Rom. viii. 30; v. 5": o "v." é versículo, não capítulo 5 de Romanos.
        self.assertEqual(R.find_refs("Rom. viii. 30; v. 5", romano=True), [par(45, 8, 30)])

    def test_padrao_sem_romano_nao_muda(self):
        self.assertEqual(R.find_refs("Rom. viii. 32."), [])
        self.assertEqual(R.find_refs("Rom 8:28"), [par(45, 8, 28)])


@unittest.skipIf(R is None, "precisa de pysword (ingest/refparse.py)")
class AbreviacaoEContinuacao(unittest.TestCase):
    def test_referencia_depois_de_palavra_que_nao_e_livro(self):
        # Strong: "In 1 Pet. 4:6" e "Contrast 2 Tim. 3:2". A palavra antes do número não pode engolir a referência.
        self.assertEqual(R.find_refs("In 1 Pet. 4:6, physical death"), [par(60, 4, 6)])
        self.assertEqual(R.find_refs("Contrast 2 Tim. 3:2—“lovers of self.”"), [par(55, 3, 2)])
        self.assertEqual(R.find_refs("In 1 Cor. 15:21, 22, the bodily"), [par(46, 15, 21), par(46, 15, 22)])
        self.assertEqual(R.find_refs("Cf. 1 Cor. 2:9—“Things which e"), [par(46, 2, 9)])

    def test_abreviacao_1_k_de_reis(self):
        # Strong usa "1 K." e "2 K." para 1 e 2 Reis.
        self.assertEqual(R.find_refs("1 K. 8:27—“behold, heaven"), [par(11, 8, 27)])
        self.assertEqual(R.find_refs("2 K. 3:4"), [par(12, 3, 4)])

    def test_palavra_sem_livro_nao_gera_referencia(self):
        self.assertEqual(R.find_refs("Verse 14. Nor could it have been"), [])
        self.assertEqual(R.find_refs("Dec. 23, 1893:807"), [])
        self.assertEqual(R.find_refs("Compare 2 Maccabees 7:28"), [])  # apócrifo: fora do cânon


if __name__ == "__main__":
    unittest.main()
