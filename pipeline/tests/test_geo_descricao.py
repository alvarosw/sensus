"""Testes da descrição geo por regra (sensus/geo_descricao.py). Regra nova = caso de AT hebraico e de NT grego.

Textos reais do openbible-geo: Abarim (AT, Números 33:47; polígono, pontuação 1000) e Cafarnaum (NT, Mateus 4:13;
Tell Hum, com votos e outra localização candidata). Hamonah traz identificação do texto (fonte 'ancient').
Rodar a partir da raiz: python3 -m unittest discover -s pipeline/tests
"""

import sys
import unittest
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))

from sensus.geo_descricao import Geo, analisa, renderiza  # noqa: E402
from sensus.descricoes_pt import ler_glossario  # noqa: E402

ABARIM = ("Best modern identification: Abarim (mountain range, polygon geometry); association score 1000/1000. "
          'Identification: "Abarim" (modern). Time-weighted score 1000/1000.')
CAFARNAUM = ("Best modern identification: Tell Hum (settlement, point geometry); association score 842/1000. "
             'Identification: "Tell Hum" (modern). Votes: authority_usually 1, confidence_likely 14, confidence_map 1, '
             "confidence_mostlikely 1, confidence_yes 13, identified_adjective 2. Time-weighted score 842/1000. "
             "1 other candidate modern location(s) in the dataset.")
HAMONAH = ("Best modern identification: Abarim (mountain range, polygon geometry); association score 229/1000. "
           'Identification: "in the Valley of Hamon-gog" (ancient). Time-weighted score 1000/1000. '
           "3 other candidate modern location(s) in the dataset.")

GLOS_ES = ler_glossario(
    "secao\tingles\tportugues\tnota\tgenero\n"
    "tipo\tmountain range\tcordillera\t\t\n"
    "tipo\tsettlement\tasentamiento\t\t\n"
    "geometria\tpolygon\tpolígono\t\t\n"
    "geometria\tpoint\tpunto\t\t\n"
    "fonte\tmodern\tmoderno\t\t\n"
    "fonte\tancient\tantiguo\t\t\n"
    "voto\tauthority_usually\tautoridad: generalmente\t\t\n"
    "voto\tconfidence_likely\tconfianza: probable\t\t\n"
    "voto\tconfidence_map\tconfianza: mapa\t\t\n"
    "voto\tconfidence_mostlikely\tconfianza: lo más probable\t\t\n"
    "voto\tconfidence_yes\tconfianza: sí\t\t\n"
    "voto\tidentified_adjective\tidentificado: adjetivo\t\t\n",
    ("tipo", "geometria", "voto", "fonte"),
)
GRAM_ES = {
    "lista_sep": ", ",
    "geo_melhor": "Mejor identificación moderna: {nome} ({tipo}, geometría {geometria}); "
                  "puntuación de asociación {score}/1000.",
    "geo_identificacao": 'Identificación: "{texto}" ({fonte}).',
    "geo_votos": "Votos: {votos}.",
    "geo_voto": "{voto} {n}",
    "geo_tempo": "Puntuación ponderada por tiempo {tempo}/1000.",
    "geo_outros": "{n} otra(s) ubicación(es) moderna(s) candidata(s) en el conjunto de datos.",
}


class AnalisaTest(unittest.TestCase):
    def test_at_abarim_so_a_melhor_identificacao(self):
        self.assertEqual(analisa(ABARIM), Geo(nome="Abarim", tipo="mountain range", geometria="polygon", score=1000,
                                              identificacao="Abarim", fonte="modern", tempo=1000))

    def test_nt_cafarnaum_com_votos_e_outra_candidata(self):
        self.assertEqual(analisa(CAFARNAUM), Geo(
            nome="Tell Hum", tipo="settlement", geometria="point", score=842, identificacao="Tell Hum",
            fonte="modern",
            votos=(("authority_usually", 1), ("confidence_likely", 14), ("confidence_map", 1),
                   ("confidence_mostlikely", 1), ("confidence_yes", 13), ("identified_adjective", 2)),
            tempo=842, outros=1))

    def test_identificacao_do_texto_fonte_ancient(self):
        g = analisa(HAMONAH)
        self.assertEqual((g.identificacao, g.fonte, g.outros), ("in the Valley of Hamon-gog", "ancient", 3))

    def test_sem_localizacao_moderna_nao_analisa(self):
        self.assertIsNone(analisa("No modern location is associated with this place in the dataset."))

    def test_trecho_que_sobra_nao_analisa(self):
        self.assertIsNone(analisa(ABARIM + " Frase nova."))

    def test_vazio(self):
        self.assertIsNone(analisa(""))
        self.assertIsNone(analisa(None))


class RenderizaTest(unittest.TestCase):
    def test_at_abarim_em_espanhol(self):
        self.assertEqual(
            renderiza(analisa(ABARIM), GLOS_ES, GRAM_ES),
            'Mejor identificación moderna: Abarim (cordillera, geometría polígono); puntuación de asociación 1000/1000. '
            'Identificación: "Abarim" (moderno). Puntuación ponderada por tiempo 1000/1000.',
        )

    def test_nt_cafarnaum_com_votos_e_outra_candidata(self):
        self.assertEqual(
            renderiza(analisa(CAFARNAUM), GLOS_ES, GRAM_ES),
            'Mejor identificación moderna: Tell Hum (asentamiento, geometría punto); puntuación de asociación 842/1000. '
            'Identificación: "Tell Hum" (moderno). Votos: autoridad: generalmente 1, confianza: probable 14, '
            'confianza: mapa 1, confianza: lo más probable 1, confianza: sí 13, identificado: adjetivo 2. '
            'Puntuación ponderada por tiempo 842/1000. 1 otra(s) ubicación(es) moderna(s) candidata(s) en el '
            'conjunto de datos.',
        )

    def test_fonte_ancient_e_contagem_de_outras(self):
        t = renderiza(analisa(HAMONAH), GLOS_ES, GRAM_ES)
        self.assertIn('Identificación: "in the Valley of Hamon-gog" (antiguo).', t)
        self.assertTrue(t.endswith("3 otra(s) ubicación(es) moderna(s) candidata(s) en el conjunto de datos."))

    def test_termo_fora_do_glossario_nao_traduz(self):
        falhas: list[str] = []
        self.assertIsNone(renderiza(analisa(ABARIM), ler_glossario(""), GRAM_ES, falhas))
        self.assertEqual(falhas, ["tipo: mountain range"])

    def test_gramatica_vazia_nao_traduz(self):
        self.assertIsNone(renderiza(analisa(ABARIM), GLOS_ES, {}))

    def test_sem_votos_nao_sai_a_frase_de_votos(self):
        t = renderiza(analisa(ABARIM), GLOS_ES, GRAM_ES)
        self.assertNotIn("Votos", t)


if __name__ == "__main__":
    unittest.main()
