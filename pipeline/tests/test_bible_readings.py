"""Testes de ingest/bible_readings.py: perguntas e respostas de Bible Readings for the Home Circle (1920).

Trechos reais do Gutenberg #34520 (itálico do Gutenberg já removido, como em carrega()): um estudo com pergunta do
AT (Êx 20:8) e outro com pergunta do NT (Rev 14:6, 7, Mt 21:42). Precisa do pysword (ingest/refparse.py); sem ele,
o teste é pulado. Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import ingest.bible_readings as B  # noqa: E402
except ImportError:  # pysword ausente no python3 do sistema
    B = None

# Estudo do AT: "Manner Of Observing The Sabbath" (pergunta 1 com Ex. 20:8; pergunta 2 só com "Verse 10", não ligada).
AT = """Manner Of Observing The Sabbath


                             [Illustration.]

 Sabbath Morning. "Remember the Sabbath day, to keep it holy." Ex. 20:8.


1. What is first commanded in the Sabbath commandment?

“Remember the Sabbath day.” Ex. 20:8.

2. Which day is the Sabbath?

“The seventh day is the Sabbath.” Verse 10.
"""

# Estudo do NT: "The Judgment-Hour Message", com legenda de ilustração antes da pergunta, e a resposta com Rev. 14:6, 7.
# Numeração das perguntas ajustada para 1 e 2 (no livro são 23 e 24).
NT = """The Judgment-Hour Message

                             [Illustration.]

 The Angel Preaching. "Fear God, and give glory to Him." Rev. 14:7.


1. How was the opening of the judgment to be made known to the world?

“And I saw another angel fly in the midst of heaven, having the everlasting gospel to preach unto them that dwell on the earth, saying with a loud voice, Fear God, and give glory to Him; for the hour of His judgment is come.” Rev. 14:6, 7.

2. Who first gave the Scriptures to men?

“The Scriptures are the words of God.” Matt. 21:42. See also Col. 3:11.
"""

# Estudo com pergunta cuja resposta é só a referência (lista de princípios), e uma resposta com "Phil. 2" ambígua.
ITENS = """Principles Underlying the Ten Commandments

1. Faith and loyalty. Heb. 11:6; Matt. 4:8-10.

2. Phil. 2 sem capítulo e versículo, que pode ser Filemom ou Filipenses.
"""


def _ligados(rows):
    return {(s, e) for s, e, _ in rows}


@unittest.skipIf(B is None, "pysword ausente (ingest/refparse.py)")
class PerguntasERespostasTest(unittest.TestCase):
    def test_estudos_titulo_e_perguntas_do_at(self):
        est = B.estudos(AT)
        self.assertEqual(len(est), 1)
        n, titulo, pares = est[0]
        self.assertEqual((n, titulo), (1, "Manner Of Observing The Sabbath"))
        self.assertEqual([p for p, _ in pares], [
            "What is first commanded in the Sabbath commandment?",
            "Which day is the Sabbath?"])
        self.assertEqual(pares[0][1], "“Remember the Sabbath day.” Ex. 20:8.")

    def test_referencia_do_at_gera_linha_com_cabecalho_e_pergunta(self):
        st = B.Counter()
        rows = B.linhas(AT, st)
        self.assertEqual(_ligados(rows), {(2020008, 2020008)})  # "Verse 10" não é ligado
        texto = rows[0][2]
        self.assertEqual(texto, "Bible Readings for the Home Circle, cap. 1 — Manner Of Observing The Sabbath\n\n"
                                "What is first commanded in the Sabbath commandment?\n\n"
                                "“Remember the Sabbath day.” Ex. 20:8.")
        self.assertEqual(st["respostas com \"Verse N\" (não ligadas)"], 1)

    def test_referencia_do_nt_com_intervalo_e_numeracao_de_pergunta_na_resposta(self):
        st = B.Counter()
        rows = B.linhas(NT, st)
        ligados = _ligados(rows)
        self.assertIn((66014006, 66014006), ligados)  # Rev. 14:6
        self.assertIn((66014007, 66014007), ligados)  # Rev. 14:7
        self.assertIn((40021042, 40021042), ligados)  # Matt. 21:42
        self.assertIn((51003011, 51003011), ligados)  # "See also Col. 3:11" depois de "28." quebrado na linha
        # A ilustração e a legenda não entram; a pergunta 24 é uma unidade própria.
        textos = {t.split("\n\n")[1] for _, _, t in rows}
        self.assertEqual(textos, {"How was the opening of the judgment to be made known to the world?",
                                  "Who first gave the Scriptures to men?"})
        self.assertTrue(all("cap. 1 — The Judgment-Hour Message" in t for _, _, t in rows))

    def test_item_sem_resposta_usa_referencias_da_propria_pergunta(self):
        st = B.Counter()
        rows = B.linhas(ITENS, st)
        self.assertEqual(_ligados(rows), {(58011006, 58011006), (40004008, 40004010)})  # Heb. 11:6; Matt. 4:8-10
        self.assertEqual(st["itens sem resposta (referências na pergunta)"], 2)  # o item 2 (Phil.) também

    def test_phil_sem_capitulo_versiculo_descarta_a_resposta(self):
        st = B.Counter()
        rows = B.linhas(ITENS, st)
        self.assertFalse(any(s // 1_000_000 in (50, 57) for s, _, _ in rows))
        self.assertEqual(st["descartadas: referência ambígua (Phil. sem capítulo:versículo)"],
                         len(B.find_refs("Phil. 2 sem capítulo e versículo, que pode ser Filemom ou Filipenses.")))


if __name__ == "__main__":
    unittest.main()
