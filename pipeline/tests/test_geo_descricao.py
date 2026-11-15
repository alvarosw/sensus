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

from sensus.geo_descricao import Geo, analisa, e_ingles, renderiza  # noqa: E402
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
# Nome moderno em inglês de frase (dado real de Mt/Mc: 'near the mouth of the Jordan River') e nome com substantivo
# geográfico inglês ('Jezreel Valley', 'Barada River'): com geo_omitir_ingles, saem.
PERTO_JORDAO = ("Best modern identification: near the mouth of the Jordan River (settlement, point geometry); "
                'association score 660/1000. Identification: "near the mouth of the Jordan River" (modern). '
                "Time-weighted score 660/1000.")
JEZREEL = ("Best modern identification: Jezreel Valley (valley, polygon geometry); association score 900/1000. "
           'Identification: "Jezreel Valley" (modern). Time-weighted score 900/1000.')
OUTRA_NAME_FOR = ("Best modern identification: Tall el Hammam (settlement, point geometry); association score 511/1000. "
                  'Identification: "another name for Shittim" (ancient). Votes: confidence_likely 3. '
                  "Time-weighted score 761/1000. 2 other candidate modern location(s) in the dataset.")

GLOS_ES = ler_glossario(
    "secao\tingles\tportugues\tnota\tgenero\n"
    "tipo\tmountain range\tcordillera\t\t\n"
    "tipo\tsettlement\tasentamiento\t\t\n"
    "tipo\tvalley\tvalle\t\t\n"
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
# Espanhol sem inglês: a opção liga a omissão e a cabeça sem nome (geo_melhor_sem_nome).
GRAM_ES_SEM_INGLES = {
    **GRAM_ES,
    "geo_omitir_ingles": "sim",
    "geo_melhor_sem_nome": "Mejor identificación moderna ({tipo}, geometría {geometria}); "
                           "puntuación de asociación {score}/1000.",
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


class SemInglesTest(unittest.TestCase):
    """geo_omitir_ingles = sim: nome moderno e identificação em inglês saem; nome próprio simples fica."""

    def test_sem_a_opcao_o_ingles_continua(self):
        self.assertIn("near the mouth of the Jordan River", renderiza(analisa(PERTO_JORDAO), GLOS_ES, GRAM_ES))

    def test_nt_nome_em_frase_inglesa_sai_e_fica_o_tipo(self):
        self.assertEqual(
            renderiza(analisa(PERTO_JORDAO), GLOS_ES, GRAM_ES_SEM_INGLES),
            "Mejor identificación moderna (asentamiento, geometría punto); puntuación de asociación 660/1000. "
            "Puntuación ponderada por tiempo 660/1000.",
        )

    def test_nome_com_substantivo_ingles_sai(self):
        self.assertEqual(
            renderiza(analisa(JEZREEL), GLOS_ES, GRAM_ES_SEM_INGLES),
            "Mejor identificación moderna (valle, geometría polígono); puntuación de asociación 900/1000. "
            "Puntuación ponderada por tiempo 900/1000.",
        )

    def test_at_identificacao_em_frase_inglesa_sai_e_o_nome_fica(self):
        self.assertEqual(
            renderiza(analisa(HAMONAH), GLOS_ES, GRAM_ES_SEM_INGLES),
            "Mejor identificación moderna: Abarim (cordillera, geometría polígono); puntuación de asociación 229/1000. "
            "Puntuación ponderada por tiempo 1000/1000. "
            "3 otra(s) ubicación(es) moderna(s) candidata(s) en el conjunto de datos.",
        )

    def test_identificacao_another_name_for_sai_com_votos(self):
        self.assertEqual(
            renderiza(analisa(OUTRA_NAME_FOR), GLOS_ES, GRAM_ES_SEM_INGLES),
            "Mejor identificación moderna: Tall el Hammam (asentamiento, geometría punto); "
            "puntuación de asociación 511/1000. Votos: confianza: probable 3. "
            "Puntuación ponderada por tiempo 761/1000. "
            "2 otra(s) ubicación(es) moderna(s) candidata(s) en el conjunto de datos.",
        )

    def test_nomes_proprios_simples_ficam(self):
        # AT (Abarim) e NT (Tell Hum, Cafarnaum): nome e identificação de origem semítica não mudam.
        for texto in (ABARIM, CAFARNAUM):
            with self.subTest(texto[:20]):
                self.assertEqual(renderiza(analisa(texto), GLOS_ES, GRAM_ES_SEM_INGLES),
                                 renderiza(analisa(texto), GLOS_ES, GRAM_ES))

    def test_cabeca_sem_nome_sem_modelo_nao_traduz(self):
        falhas: list[str] = []
        gram = {**GRAM_ES, "geo_omitir_ingles": "sim"}
        self.assertIsNone(renderiza(analisa(PERTO_JORDAO), GLOS_ES, gram, falhas))
        self.assertEqual(falhas, ["geo_melhor_sem_nome"])

    def test_e_ingles(self):
        self.assertTrue(e_ingles("another name for Acco"))
        self.assertTrue(e_ingles("in the Valley of Siddim"))
        self.assertTrue(e_ingles("Jezreel Valley"))
        self.assertFalse(e_ingles("Tel Abel Beth Maacah"))
        self.assertFalse(e_ingles("Tell Hum"))
        self.assertFalse(e_ingles("Duleilat esh Sharqiyeh"))
        # 'wadi' é termo árabe (usado em inglês), não palavra inglesa: 'Wadi el Melek' é nome que fica.
        self.assertFalse(e_ingles("Wadi el Melek"))


# Escrita não latina (russo como língua de teste): o nome e a identificação em letras latinas trocam pelo nome da
# língua quando a entidade tem nome (nomes), e saem quando não tem. Caso AT (Moab, Números/Juízes) e NT (Antioquia).
MOAB = ("Best modern identification: Moab 2 (region, polygon geometry); association score 900/1000. "
        'Identification: "Moab 2" (modern). Time-weighted score 900/1000.')
ANTIOQUIA = ("Best modern identification: Antioch (settlement, point geometry); association score 760/1000. "
             'Identification: "Antioch" (modern). Votes: confidence_likely 5. Time-weighted score 760/1000. '
             "1 other candidate modern location(s) in the dataset.")
EGITO = ('Best modern identification: Egypt (country, polygon geometry); association score 500/1000. '
         'Identification: "Egypt" (modern). Time-weighted score 500/1000.')
GLOS_RU = ler_glossario(
    "secao\tingles\tportugues\tnota\tgenero\n"
    "tipo\tregion\tрегион\t\t\n"
    "tipo\tsettlement\tпоселение\t\t\n"
    "tipo\tcountry\tстрана\t\t\n"
    "geometria\tpolygon\tполигон\t\t\n"
    "geometria\tpoint\tточка\t\t\n"
    "fonte\tmodern\tсовременная\t\t\n"
    "fonte\tancient\tдревняя\t\t\n"
    "voto\tconfidence_likely\tуверенность: вероятно\t\t\n",
    ("tipo", "geometria", "voto", "fonte"),
)
GRAM_RU = {
    "lista_sep": ", ",
    "geo_melhor": "Лучшее современное отождествление: {nome} ({tipo}, геометрия: {geometria}); "
                  "балл ассоциации: {score}/1000.",
    "geo_melhor_sem_nome": "Лучшее современное отождествление ({tipo}, геометрия: {geometria}); "
                           "балл ассоциации: {score}/1000.",
    "geo_identificacao": 'Идентификация: "{texto}" ({fonte}).',
    "geo_votos": "Голоса: {votos}.",
    "geo_voto": "{voto} {n}",
    "geo_tempo": "Балл с учётом времени {tempo}/1000.",
    "geo_outros": "{n} другая(ых) современная(ых) локация(й) в наборе данных.",
    "geo_omitir_ingles": "sim",
}


class EscritaNaoLatinaTest(unittest.TestCase):
    def test_at_moab_com_nome_na_lingua_troca_cabeca_e_identificacao(self):
        self.assertEqual(
            renderiza(analisa(MOAB), GLOS_RU, GRAM_RU, lingua="ru", nomes={"Moab": "Моав"}),
            "Лучшее современное отождествление: Моав (регион, геометрия: полигон); балл ассоциации: 900/1000. "
            'Идентификация: "Моав" (современная). Балл с учётом времени 900/1000.',
        )

    def test_at_moab_sem_nome_na_lingua_omite_so_o_trecho_latino(self):
        self.assertEqual(
            renderiza(analisa(MOAB), GLOS_RU, GRAM_RU, lingua="ru", nomes={}),
            "Лучшее современное отождествление (регион, геометрия: полигон); балл ассоциации: 900/1000. "
            "Балл с учётом времени 900/1000.",
        )

    def test_nt_antioquia_com_votos_e_outra_candidata(self):
        self.assertEqual(
            renderiza(analisa(ANTIOQUIA), GLOS_RU, GRAM_RU, lingua="ru", nomes={"Antioch": "Антиохия"}),
            "Лучшее современное отождествление: Антиохия (поселение, геометрия: точка); балл ассоциации: 760/1000. "
            'Идентификация: "Антиохия" (современная). Голоса: уверенность: вероятно 5. '
            "Балл с учётом времени 760/1000. 1 другая(ых) современная(ых) локация(й) в наборе данных.",
        )

    def test_nt_antioquia_sem_nome_mantem_numeros_e_votos(self):
        t = renderiza(analisa(ANTIOQUIA), GLOS_RU, GRAM_RU, lingua="ru", nomes={})
        self.assertNotIn("Antioch", t)
        self.assertIn("Голоса: уверенность: вероятно 5.", t)
        self.assertTrue(t.startswith(
            "Лучшее современное отождествление (поселение, геометрия: точка); балл ассоциации: 760/1000."))

    def test_nome_latino_sem_traducao_sai_com_o_tipo(self):
        self.assertEqual(
            renderiza(analisa(EGITO), GLOS_RU, GRAM_RU, lingua="ru", nomes={}),
            "Лучшее современное отождествление (страна, геометрия: полигон); балл ассоциации: 500/1000. "
            "Балл с учётом времени 500/1000.",
        )

    def test_lingua_latina_ou_sem_lingua_nao_muda(self):
        for lingua in (None, "pt", "es"):
            with self.subTest(lingua=lingua):
                self.assertEqual(
                    renderiza(analisa(MOAB), GLOS_RU, GRAM_RU, lingua=lingua, nomes={"Moab": "Моав"}),
                    renderiza(analisa(MOAB), GLOS_RU, GRAM_RU),
                )


if __name__ == "__main__":
    unittest.main()
