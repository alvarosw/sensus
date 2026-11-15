"""Testes de sensus/escritas.py (perfis de escrita por língua) e do que eles mudam em names_pt.

Regra nova = caso de NT grego e de AT hebraico. Os textos são curtos e de tradução própria (a referência está no
comentário de cada caso), só para exercitar a regra; não são citação de Bíblia licenciada.
Rodar a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.escritas import LIMIARES_ZH, PERFIS, escrita_ok  # noqa: E402
from sensus.names_pt import (  # noqa: E402
    candidates, choose, escolhe_frase, frases, ocorrencias, pontua, similarity,
)

ES = PERFIS["es"]
RU = PERFIS["ru"]
ZH = PERFIS["zh"]
PT = PERFIS["pt"]


def _chave(perfil, texto, vocabulario):
    return perfil.chave(texto, frozenset(vocabulario))


class EscritaTest(unittest.TestCase):
    def test_escrita_esperada_por_lingua(self):
        # AT hebraico (Moisés, Aarón em várias escritas) e NT grego (Pedro, Paulo)
        casos = [
            ("zh", "以色列", True), ("zh", "Israel", False),
            ("ja", "モーセ", True), ("ja", "以色列", True), ("ja", "Moses", False),
            ("ar", "موسى", True), ("ar", "Moses", False),
            ("ur", "موسیٰ", True), ("ur", "Moses", False),
            ("hi", "मूसा", True), ("hi", "Moses", False),
            ("bn", "মোশি", True), ("bn", "Moses", False),
            ("ru", "Моисей", True), ("ru", "Moisés", False),
            ("es", "Moisés", True), ("es", "Моисей", False),
            ("fr", "Élie", True), ("vi", "Môi-se", True), ("vi", "Phi-e-rơ", True), ("id", "Musa", True),
            ("de", "Petrus", True), ("pt", "Pedro", True),
        ]
        for lang, texto, esperado in casos:
            with self.subTest(lang=lang, texto=texto):
                self.assertEqual(escrita_ok(lang, texto), esperado)

    def test_sem_letras_nao_e_escrita_ok(self):
        self.assertFalse(escrita_ok("es", ""))
        self.assertFalse(escrita_ok("zh", "。；"))

    def test_saida_tira_tashkil_e_marca_do_urdu(self):
        self.assertEqual(PERFIS["ar"].saida("مُوسَى"), "موسى")
        self.assertEqual(PERFIS["ur"].saida("موسیٰؔ"), "موسی")  # ٰ (U+0670) e ؔ saem
        self.assertEqual(PERFIS["pt"].saida("Pedro"), "Pedro")


class FlexaoTest(unittest.TestCase):
    def test_russo_forma_de_citacao_do_nominativo(self):
        # Авраама -> Авраам; Моисея -> Моисей; Иуды -> Иуда; Ноя -> Ной; Илии -> Илия (AT). Nenhuma delas muda
        # quando já está no nominativo ou quando o nominativo não aparece no vocabulário.
        vocab = {"Авраам", "Моисей", "Иуда", "Ной", "Илия", "Петр"}
        self.assertEqual(_chave(RU, "Авраама", vocab), "Авраам")
        self.assertEqual(_chave(RU, "Моисея", vocab), "Моисей")
        self.assertEqual(_chave(RU, "Иуды", vocab), "Иуда")
        self.assertEqual(_chave(RU, "Ноя", vocab), "Ной")
        self.assertEqual(_chave(RU, "Илии", vocab), "Илия")
        self.assertEqual(_chave(RU, "Авраам", vocab), "Авраам")
        self.assertEqual(_chave(RU, "Петра", {"Петра"}), "Петра")  # NT: sem nominativo no corpus, fica como está

    def test_alemao_genitivo_s_so_com_forma_sem_s_no_corpus(self):
        de = PERFIS["de"]
        self.assertEqual(_chave(de, "Abrahams", {"Abraham"}), "Abraham")  # AT
        self.assertEqual(_chave(de, "Jakobs", {"Jakob"}), "Jakob")
        self.assertEqual(_chave(de, "Petrus", {"Petrus"}), "Petrus")  # NT: 's' final de nome, sem genitivo

    def test_ru_romanizacao_para_comparar_com_ingles(self):
        self.assertEqual(RU.romaniza("Моисей"), "moisey")
        self.assertEqual(PERFIS["hi"].romaniza("मूसा"), "musa")
        self.assertEqual(PERFIS["bn"].romaniza("মোশি"), "moshi")
        self.assertEqual(PERFIS["ja"].romaniza("モーセ"), "moose")  # ー repete a vogal anterior

    def test_ja_e_zh_sem_flexao(self):
        self.assertEqual(_chave(PERFIS["ja"], "モーセ", {"モーセ"}), "モーセ")
        self.assertEqual(_chave(ZH, "以色列", {"以色列"}), "以色列")


class CandidatosTest(unittest.TestCase):
    def test_latino_so_maiuscula_inicial(self):
        # AT: Levítico 10:1 em espanhol (Aarón, Nadab, Abiú); a palavra minúscula 'hijos' fica fora.
        texto = "Y los hijos de Aarón, Nadab y Abiú, tomaron cada uno su incensario."
        self.assertEqual(ES.candidatos(texto) & {"Aarón", "Nadab", "Abiú", "hijos"}, {"Aarón", "Nadab", "Abiú"})

    def test_pt_igual_ao_regex_de_antes(self):
        # NT: Romanos 16:14 (Asíncrito, Flegonte, Hermas). O pt continua com a regex de antes.
        self.assertEqual(candidates("Saudai Asíncrito, Flegonte, Hermas"), {"Saudai", "Asíncrito", "Flegonte", "Hermas"})

    def test_arabe_palavra_sem_proclitico(self):
        # AT: 'وموسى' (e Moisés) gera também 'موسى' sem o و de conjunção.
        self.assertIn("موسى", PERFIS["ar"].candidatos("وموسى قال"))

    def test_urdu_so_palavras_com_marca_do_nome(self):
        # urdoucv: ؔ marca o nome no texto (AT: Adão, Éden). A palavra sem marca fica fora; a saída tira a marca.
        self.assertEqual(PERFIS["ur"].candidatos("آدمؔ اور عدنؔ کی زمین"), {"آدم", "عدن"})

    def test_bengali_danda_fora_do_nome(self):
        # benirv usa ৷ (U+09F7) como danda: não pode colar no nome. AT: Esdras 10:43 (Uri); NT: Mateus 1:16 (José).
        self.assertIn("ঊরি", PERFIS["bn"].candidatos("সবিনা ও ঊরি৷"))
        self.assertNotIn("ঊরি৷", PERFIS["bn"].candidatos("সবিনা ও ঊরি৷"))
        self.assertEqual({c for c in PERFIS["bn"].candidatos("যাকোবের ছেলে যোষেফ৷") if "৷" in c}, set())

    def test_zh_so_nomes_marcados(self):
        # zh: o texto não entra; os candidatos vêm dos \pn (ver ebible.nomes_marcados). Sem marcação, nada.
        self.assertEqual(ZH.candidatos("以色列人"), set())


class PontuacaoTest(unittest.TestCase):
    def test_pt_formula_igual_a_de_antes(self):
        s, c, e = 0.9, 0.5, 0.4
        self.assertAlmostEqual(PT.pontuacao(s, c, e), s * s * (0.5 + 0.5 * c) * (0.3 + 0.7 * e ** 0.3))

    def test_zh_ignora_grafia(self):
        self.assertEqual(ZH.pontuacao(0.0, 0.5, 0.4), ZH.pontuacao(1.0, 0.5, 0.4))
        self.assertEqual(LIMIARES_ZH.via2_versos, 3)

    def test_escolha_zh_pelos_marcados(self):
        # AT: Gênesis 1 (vid 1001001..) -- 'Israel' em 3 versículos; 以色列 aparece nos 3, 雅各 só em 1.
        vc = {1001001: {"以色列", "雅各"}, 1001002: {"以色列"}, 1001003: {"以色列"}}
        vc.update({1000000 + i: {"雅各"} for i in range(4, 9)})  # 雅各 é comum no corpus
        df = Counter(c for s in vc.values() for c in s)
        esc = choose("Israel", [1001001, 1001002, 1001003], vc, df, ZH)
        self.assertEqual(esc.nome, "以色列")
        self.assertEqual(esc.confianca, "alta")  # via 2: 3 versículos, cobertura 1, especificidade 1

    def test_escolha_com_poda_igual_ao_ranking_completo(self):
        # Mesma escolha do ranking completo (com o segundo colocado) em um caso com muitos candidatos (NT grego).
        vc = {1: {"Asíncrito", "Flegonte", "Hermas"}, 2: {"Hermas", "Patrobas", "Hermes"}, 3: {"Hermes", "Asíncrito"}}
        vc.update({10 + i: {f"Palavra{i}", "Hermas"} for i in range(5)})
        df = Counter(c for s in vc.values() for c in s)
        esc = choose("Asyncritus", [1, 3], vc, df, ES)
        self.assertEqual(esc.nome, "Asíncrito")
        ranking = sorted(
            ((-(lambda p: p[0] * p[0] * (0.5 + 0.5 * p[1]) * (0.3 + 0.7 * p[2] ** 0.3))(
                (similarity("Asyncritus", ES.romaniza(c)), kc / 2, kc / df[c])), c)
             for c, kc in Counter(x for v in (1, 3) for x in vc[v]).items()))
        self.assertEqual(esc.alternativa, ranking[1][1])

    def test_escolha_at_hebraico_abiu(self):
        # AT: Levítico 10:1 (Abiú) em espanhol; Abiú aparece no versículo, Aarón e Nadab também, e o nome pesa.
        vc = {3010001: {"Aarón", "Nadab", "Abiú"}, 3010002: {"Aarón"}}
        vc.update({3000000 + i: {"Aarón"} for i in range(3, 9)})
        df = Counter(c for s in vc.values() for c in s)
        esc = choose("Abihu", [3010001], vc, df, ES)
        self.assertEqual(esc.nome, "Abiú")


class FrasesTest(unittest.TestCase):
    def test_pt_forma_com_espaco(self):
        # pt: 'monte de' + 'Oliveiras' (NT: Monte das Oliveiras, Mt 21:1)
        self.assertEqual(frases(("monte de", "monte das"), "Oliveiras"), ["monte de Oliveiras", "monte das Oliveiras"])

    def test_forma_com_marcador_n(self):
        # zh: sem espaço, o núcleo entra no lugar do marcador ('{n}山'). AT: 以色列山 (monte de Israel)
        self.assertEqual(frases(("{n}山",), "以色列"), ["以色列山"])
        self.assertEqual(frases(("monte {n}",), "Sinai"), ["monte Sinai"])

    def test_zh_nao_captura_sem_nucleo(self):
        self.assertEqual(ocorrencias("以色列山上", ("{n}山",), None, ZH), [])

    def test_escolhe_frase_com_perfil(self):
        # NT: 'monte de' + 'Oliveiras' no texto em espanhol (Mt 21:1): frase achada no versículo
        textos = {1: "Cuando llegaron al monte de Olivos, Jesús envió dos discípulos."}
        f = escolhe_frase(("monte de",), "Olives", "Olivos", [1], textos, ES)
        self.assertEqual(f.candidato, "monte de Olivos")
        self.assertEqual(f.confianca, "alta")


class PontuaTest(unittest.TestCase):
    def test_pontua_usa_romanizacao(self):
        vc = {1: {"Моисей"}}
        df = Counter({"Моисей": 1})
        s, cov, esp, n = pontua("Moses", "Моисей", [1], vc, df, RU)
        self.assertEqual((cov, esp, n), (1.0, 1.0, 1))
        self.assertAlmostEqual(s, similarity("Moses", "moisey"))


class ArabeTest(unittest.TestCase):
    """Árabe (arbvd): proclíticos, nomes compostos com hífen e escolha. Textos curtos de tradução própria."""

    AR = PERFIS["ar"]

    def _vc(self, textos):
        atest = frozenset(p for t in textos.values() for p in self.AR.palavras(t))
        vc = {v: self.AR.candidatos(t, atest) for v, t in textos.items()}
        return vc, Counter(c for s in vc.values() for c in s)

    def test_proclitico_e_retirado_sem_perder_letra_do_nome(self):
        # NT: Mateus 1:15 (Matã, precedido de و de conjunção): 'ومتان' também dá 'متان'.
        self.assertIn("متان", self.AR.candidatos("ومتان ولد يعقوب"))
        # AT: Gênesis 38:29 (Perez = فارص): o ف faz parte do nome. 'ارص' só entra se aparece sozinho no corpus.
        self.assertNotIn("ارص", self.AR.candidatos("فدعى اسمه فارص"))
        self.assertIn("ارص", self.AR.candidatos("فدعى اسمه فارص", frozenset({"ارص"})))

    def test_escolha_perez_mantem_o_pe(self):
        # AT: Gênesis 38:29 (Perez). 'فارص' aparece em dois versículos; a forma sem o ف não aparece no corpus.
        textos = {1: "فدعى اسمه فارص", 2: "ثم خرج أخوه وفارص يتبعه"}
        vc, df = self._vc(textos)
        esc = choose("Perez", [1, 2], vc, df, self.AR)
        self.assertEqual(esc.nome, "فارص")

    def test_escolha_lisanias_sem_conjuncao(self):
        # NT: Lucas 3:1 (Lisânias, tetrarca da Abilene): 'وليسانيوس' perde o و, o nome é 'ليسانيوس'.
        textos = {1: "وليسانيوس رئيس للأبلية", 2: "ليسانيوس الرئيس"}
        vc, df = self._vc(textos)
        self.assertEqual(choose("Lysanias", [1, 2], vc, df, self.AR).nome, "ليسانيوس")

    def test_sequencia_de_palavras_para_nome_com_hifen(self):
        # AT: Josué 10:10 (Bete-Horom = بيت حورون, duas palavras; و de conjunção em 'وبيت').
        self.assertIn("بيت حورون", self.AR.sequencias("وطردهم الرب في بيت حورون"))
        # preposição não entra no começo ou no fim do nome: 'في عصيون جابر' não é o nome
        seq = self.AR.sequencias("وسكن في عصيون جابر")
        self.assertIn("عصيون جابر", seq)
        self.assertNotIn("في عصيون جابر", seq)

    def test_escolha_composto_com_hifen_usa_sequencia(self):
        # AT: Josué 10:10 (Beth-horon). Só o nome com hífen recebe sequências (mapa à parte, como em nomes.py).
        textos = {1: "وطردهم الرب في بيت حورون", 2: "وبيت حورون ضربهم", 3: "وعقبة بيت حورون"}
        vc = {v: self.AR.candidatos(t) | self.AR.sequencias(t) for v, t in textos.items()}
        df = Counter(c for s in vc.values() for c in s)
        self.assertEqual(choose("Beth-horon", [1, 2, 3], vc, df, self.AR).nome, "بيت حورون")


if __name__ == "__main__":
    unittest.main()
