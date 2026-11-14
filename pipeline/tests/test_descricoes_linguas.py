"""Testes da gramática por língua das descrições (sensus/descricoes_pt.py, sensus/flexao.py, sensus/book_abbr.py) e do
ingestor por língua (ingest/descricoes.py). Regra nova = caso de AT hebraico e de NT grego.

Casos: Arão (AT, Êxodo 4:14; modelo TIPNR com todas as relações) e Bartimeu (NT, Marcos 10:46, nome grego), em es;
genitivo em ru (NT, 'сын Тимея'); feminino e ordem das palavras em hi (AT, Gênesis 38:2); ordem, pontuação e nome que
não pode ficar em inglês em zh (AT e NT); elisão em fr; genitivo bengali em bn. As gramáticas e glossários de teste ficam
aqui, não no repositório. Rodar a partir da raiz: python3 -m unittest discover -s pipeline/tests
"""

import sys
import unittest
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "ingest"))

from sensus.book_abbr import abreviaturas  # noqa: E402
from sensus.descricoes_pt import (  # noqa: E402
    GRAMATICA_PT, ler_glossario, ler_gramatica, ref_pt, traduz_descricao, traduz_paragrafo,
)
from sensus.flexao import elisao_fr, eufonia_es, genitivo_bn, genitivo_ru  # noqa: E402
import aplica_descricoes as aplica  # noqa: E402
import descricoes as ingestor  # noqa: E402

ARAO = ("A high priest from the tribe of Levi living at the time of Egypt and Wilderness, first mentioned at Exo.4.14)"
        "\n\nreferred to as Aaron (אַהֲרֹן), or Aaron (Ἀαρών);\n\nson of Amram and Jochebed;\n\na brother of Moses "
        "and Miriam;\n\nhusband of Elisheba;\n\nfather of Nadab, Abihu, Eleazar and Ithamar.")
BARTIMEU = ("A man living at the time of the New Testament, only mentioned at Mrk.10.46)\n\nonly referred to as "
            "Bartimaeus (Βαρτιμαῖος);\n\na son of Timaeus.")
JUDA_MULHER = "A woman from the tribe of Judah first mentioned at Gen.38.2)"
JUDA_HOMEM = "A man from the tribe of Judah first mentioned at Gen.38.2)"


def gram(**trocas) -> dict:
    """Gramática da língua de teste: a do pt com as chaves trocadas."""
    return {**GRAMATICA_PT, **trocas}


# ---- espanhol: AT (Arão) e NT (Bartimeu) -----------------------------------------------------------------------------

ES_GLOS = ler_glossario(
    "secao\tingles\tportugues\tnota\tgenero\n"
    "cargo\thigh priest\tsumo sacerdote\t\tm\n"
    "cargo\tman\thombre\t\tm\n"
    "tribo\tLevi\tLeví\t\t\n"
    "tempo\tat the time of Egypt and Wilderness\tde la época de Egipto y del desierto\t\t\n"
    "tempo\tat the time of the New Testament\tde la época del Nuevo Testamento\t\t\n"
    "relacao\tson of\thijo de\t\t\n"
    "relacao\tbrother of\thermano de\t\t\n"
    "relacao\thusband of\tesposo de\t\t\n"
    "relacao\tfather of\tpadre de\t\t\n"
)
ES_GRAM = gram(
    mencao_primeira="primera mención en {ref}",
    mencao_unica="solo aparece en {ref}",
    comp_tribo="de la tribu de {tribo}",
    comp_territorio_tribo="en el territorio de la tribu de {tribo}{perto}",
    comp_perto_sufixo=", cerca de {nome}",
    citacao="Llamado de {lista}",
    citacao_apenas="Llamado solo de {lista}",
    conector_e=" y ",
    conector_ou=" o ",
)
ES_NOMES = {"Aaron": "Aarón", "Amram": "Amram", "Jochebed": "Jocabed", "Moses": "Moisés", "Miriam": "Miriam",
            "Elisheba": "Elisebá", "Nadab": "Nadab", "Abihu": "Abiú", "Eleazar": "Eleazar", "Ithamar": "Itamar",
            "Timaeus": "Timeo", "Bartimaeus": "Bartimeo"}
ES_ABREV = abreviaturas("es")


class EspanholTest(unittest.TestCase):
    def test_at_arao_com_todas_as_relacoes(self):
        ref = ES_ABREV[1]  # Éx
        self.assertEqual(
            traduz_descricao(ARAO, ES_GLOS, ES_NOMES, ES_GRAM, ES_ABREV),
            f"Sumo sacerdote de la tribu de Leví, de la época de Egipto y del desierto; primera mención en {ref} 4:14."
            "\n\nLlamado de Aarón (אַהֲרֹן) o Aarón (Ἀαρών);"
            "\n\nhijo de Amram y Jocabed;"
            "\n\nhermano de Moisés y Miriam;"
            "\n\nesposo de Elisebá;"
            "\n\npadre de Nadab, Abiú, Eleazar y Itamar.",
        )

    def test_nt_bartimeu_so_aparece(self):
        ref = ES_ABREV[40]  # Mr
        self.assertEqual(
            traduz_descricao(BARTIMEU, ES_GLOS, ES_NOMES, ES_GRAM, ES_ABREV),
            f"Hombre de la época del Nuevo Testamento; solo aparece en {ref} 10:46."
            "\n\nLlamado solo de Bartimeo (Βαρτιμαῖος);"
            "\n\nhijo de Timeo.",
        )

    def test_nome_sem_traducao_fica_em_ingles_no_espanhol(self):
        self.assertIn("hijo de Timaeus.", traduz_descricao(BARTIMEU, ES_GLOS, {}, ES_GRAM, ES_ABREV))

    def test_gramatica_vazia_nao_traduz_nada(self):
        self.assertIsNone(traduz_descricao(ARAO, ES_GLOS, ES_NOMES, {}, ES_ABREV))
        self.assertIsNone(traduz_descricao(BARTIMEU, ES_GLOS, ES_NOMES, {}, ES_ABREV))

    def test_glossario_sem_termo_nao_traduz(self):
        self.assertIsNone(traduz_descricao(BARTIMEU, ler_glossario(""), ES_NOMES, ES_GRAM, ES_ABREV))


# ---- russo: genitivo do nome na relação (NT) --------------------------------------------------------------------------

RU_GLOS = ler_glossario(
    "secao\tingles\tportugues\tnota\tgenero\n"
    "relacao\tson of\tсын\t\tm\n"
    "relacao\tbrother of\tбрат\t\tm\n"
)
RU_GRAM = gram(flexao_relacao="genitivo_ru", conector_e=" и ", mencao_unica="упоминается только в {ref}")


class Russo(unittest.TestCase):
    def test_nt_genitivo_de_timeu(self):
        t = traduz_paragrafo("a son of Timaeus.", RU_GLOS, {"Timaeus": "Тимей"}, RU_GRAM)
        self.assertEqual(t, "сын Тимея.")

    def test_at_genitivo_de_abraao(self):
        t = traduz_paragrafo("a brother of Abraham and Moses;", RU_GLOS, {"Abraham": "Авраам", "Moses": "Моисей"},
                             RU_GRAM)
        self.assertEqual(t, "брат Авраама и Моисея;")

    def test_nome_sem_forma_russa_falha(self):
        falhas: list[str] = []
        self.assertIsNone(traduz_paragrafo("a son of Timaeus.", RU_GLOS, {}, RU_GRAM, falhas=falhas))
        self.assertEqual(falhas, ["Timaeus"])

    def test_genitivo_ambiguo_falha(self):
        # Ь final não tem regra segura: a descrição cai na tradução automática.
        self.assertIsNone(traduz_paragrafo("a son of Ruth.", RU_GLOS, {"Ruth": "Руфь"}, RU_GRAM))


# ---- hindi: feminino na concordância e ordem (AT) ---------------------------------------------------------------------

HI_GLOS = ler_glossario(
    "secao\tingles\tportugues\tnota\tgenero\n"
    "cargo\twoman\tस्त्री\t\tf\n"
    "cargo\tman\tपुरुष\t\tm\n"
    "tribo\tJudah\tयहूदा\t\t\n"
    "relacao\tson of\tपुत्र\t\tm\n"
)
HI_GRAM = gram(
    frase_cargo_comp="{comp} {cargo}",
    **{"comp_tribo": "{tribo} गोत्र का", "comp_tribo.f": "{tribo} गोत्र की"},
    mencao_primeira="पहली बार {ref} में",
    lista_sep=", ",
    conector_e=" और ",
)


class Hindi(unittest.TestCase):
    def test_at_feminino_concorda_com_a_postposicao(self):
        self.assertEqual(traduz_paragrafo(JUDA_MULHER, HI_GLOS, {}, HI_GRAM, ["Gn"] * 66),
                         "यहूदा गोत्र की स्त्री; पहली बार Gn 38:2 में.")

    def test_at_masculino_usa_a_forma_comum(self):
        self.assertEqual(traduz_paragrafo(JUDA_HOMEM, HI_GLOS, {}, HI_GRAM, ["Gn"] * 66),
                         "यहूदा गोत्र का पुरुष; पहली बार Gn 38:2 में.")

    def test_sem_modelo_de_feminino_usa_o_comum(self):
        gram_sem_f = {k: v for k, v in HI_GRAM.items() if not k.endswith(".f")}
        self.assertEqual(traduz_paragrafo(JUDA_MULHER, HI_GLOS, {}, gram_sem_f, ["Gn"] * 66),
                         "यहूदा गोत्र का स्त्री; पहली बार Gn 38:2 में.")


# ---- chinês: ordem, pontuação e nome que não pode ficar em inglês -----------------------------------------------------

ZH_GLOS = ler_glossario(
    "secao\tingles\tportugues\tnota\tgenero\n"
    "cargo\tman\t人\t\tn\n"
    "tribo\tJudah\t犹大\t\t\n"
    "tempo\tat the time of the New Testament\t新约时代\t\t\n"
    "relacao\tson of\t{x}的儿子\t\t\n"
)
ZH_GRAM = gram(
    frase_cargo_comp="{comp}的{cargo}",
    frase_tempo_com_comp="{frase}{pont.,}{tempo}",
    frase_tempo_sem_comp="{frase}{pont.,}{tempo}",
    cabecalho="{frase}{pont.;}{mencao}{pont..}",
    **{"pont.;": "；", "pont..": "。", "pont.,": "，"},
    comp_tribo="{tribo}支派",
    mencao_primeira="首次提及于{ref}",
    mencao_unica="仅出现于{ref}",
    citacao="称为{lista}",
    citacao_apenas="仅称为{lista}",
    original="（{original}）",
    lista_sep="、",
    conector_e="和",
    conector_ou="或",
    maiuscula_inicial="nao",
    nome_ingles_permitido="nao",
)


class Chines(unittest.TestCase):
    def test_at_complemento_antes_do_cargo_e_pontuacao_propria(self):
        ref = abreviaturas("zh")[0]  # Gn
        self.assertEqual(traduz_paragrafo(JUDA_HOMEM, ZH_GLOS, {"Judah": "犹大"}, ZH_GRAM, abreviaturas("zh")),
                         f"犹大支派的人；首次提及于{ref} 38:2。")

    def test_nt_tempo_com_virgula_chinesa_e_nome_com_parenteses(self):
        ref = abreviaturas("zh")[40]  # Mc (Marcos) na tabela zh
        t = traduz_descricao(BARTIMEU, ZH_GLOS, {"Bartimaeus": "巴底买", "Timaeus": "提马乌"}, ZH_GRAM,
                             abreviaturas("zh"))
        self.assertEqual(t, f"人，新约时代；仅出现于{ref} 10:46。\n\n仅称为巴底买（Βαρτιμαῖος）；\n\n提马乌的儿子。")

    def test_nome_sem_forma_chinesa_falha(self):
        # Nas escritas não latinas, nome citado sem forma local faz a descrição falhar.
        self.assertIsNone(traduz_descricao(BARTIMEU, ZH_GLOS, {}, ZH_GRAM, abreviaturas("zh")))


# ---- espanhol: eufonia das conjunções (y -> e, o -> u) ----------------------------------------------------------------

class EufoniaEspanhol(unittest.TestCase):
    def test_at_y_vira_e_antes_de_i(self):
        # Êx 4:14 (Arão): pai de Nadabe, Abiú, Eleazar e Itamar.
        g = {**ES_GRAM, "pos": "eufonia_es"}
        self.assertEqual(traduz_paragrafo("father of Nadab, Abihu, Eleazar and Ithamar.", ES_GLOS, ES_NOMES, g),
                         "padre de Nadab, Abiú, Eleazar e Itamar.")

    def test_nt_o_vira_u_antes_de_o(self):
        # Mt 1:9 (Ozias, Ὀζίας): 'o' antes de 'O' vira 'u'; antes de outra vogal fica.
        self.assertEqual(eufonia_es("Se le llama Uzías o Ozías (Ὀζίας)"), "Se le llama Uzías u Ozías (Ὀζίας)")
        self.assertEqual(eufonia_es("Se le llama Timeo o Bartimeo"), "Se le llama Timeo o Bartimeo")

    def test_hi_e_hie(self):
        self.assertEqual(eufonia_es("hijo de Abiú y Hiram"), "hijo de Abiú e Hiram")
        self.assertEqual(eufonia_es("Leví y Hierápolis"), "Leví y Hierápolis")
        self.assertEqual(eufonia_es("Hori o Horeo"), "Hori u Horeo")
        self.assertEqual(eufonia_es("hijo de Isaí"), "hijo de Isaí")


# ---- francês: elisão do 'de' -------------------------------------------------------------------------------------------

FR_GLOS = ler_glossario("secao\tingles\tportugues\tnota\tgenero\nrelacao\tson of\tfils de\t\t\n")
FR_GRAM = gram(pos="elisao_fr")


class Frances(unittest.TestCase):
    def test_nt_elisao_antes_de_vogal(self):
        self.assertEqual(traduz_paragrafo("a son of Abraham;", FR_GLOS, {"Abraham": "Abraham"}, FR_GRAM),
                         "fils d'Abraham;")

    def test_sem_elisao_antes_de_consoante(self):
        self.assertEqual(traduz_paragrafo("a son of Timaeus;", FR_GLOS, {"Timaeus": "Timée"}, FR_GRAM),
                         "fils de Timée;")

    def test_at_elisao_antes_de_h_maiusculo_de_nome(self):
        # Gn 4:17 (Enoque, Hénoc em francês): 'de H' é nome de h mudo, então 'd''.
        self.assertEqual(traduz_paragrafo("a son of Enoch;", FR_GLOS, {"Enoch": "Hénoc"}, FR_GRAM),
                         "fils d'Hénoc;")

    def test_nt_elisao_antes_de_herodes(self):
        # Mt 2:1 (Herodes, Hérode em francês).
        self.assertEqual(traduz_paragrafo("a son of Herod;", FR_GLOS, {"Herod": "Hérode"}, FR_GRAM),
                         "fils d'Hérode;")

    def test_pos_desconhecido_e_erro_de_gramatica(self):
        with self.assertRaises(ValueError):
            traduz_paragrafo("a son of Abraham;", FR_GLOS, {}, gram(pos="inventado"))


# ---- bengali: genitivo vogal/consoante (AT) ----------------------------------------------------------------------------

BN_GLOS = ler_glossario("secao\tingles\tportugues\tnota\tgenero\nrelacao\tson of\t{x} ছেলে\t\tm\n")
BN_GRAM = gram(flexao_relacao="genitivo_bn")


class Bengali(unittest.TestCase):
    def test_at_genitivo_com_vogal_final(self):
        self.assertEqual(traduz_paragrafo("a son of Moses;", BN_GLOS, {"Moses": "মোশি"}, BN_GRAM), "মোশির ছেলে;")

    def test_nome_fora_da_escrita_falha(self):
        self.assertIsNone(traduz_paragrafo("a son of Moses;", BN_GLOS, {}, BN_GRAM))


# ---- flexão, abreviaturas e glossário -----------------------------------------------------------------------------------

class FlexaoTest(unittest.TestCase):
    def test_genitivo_ru(self):
        self.assertEqual(genitivo_ru("Авраам"), "Авраама")
        self.assertEqual(genitivo_ru("Моисей"), "Моисея")
        self.assertEqual(genitivo_ru("Иуда"), "Иуды")
        self.assertEqual(genitivo_ru("Илия"), "Илии")
        self.assertEqual(genitivo_ru("Ной"), "Ноя")

    def test_genitivo_ru_conservador(self):
        for nome in ("Руфь", "Timaeus", "Иисус Христос", "Иоанн-Креститель", "Иоанне"):
            with self.subTest(nome):
                self.assertIsNone(genitivo_ru(nome))

    def test_genitivo_bn(self):
        self.assertEqual(genitivo_bn("মোশি"), "মোশির")
        self.assertEqual(genitivo_bn("যোহন"), "যোহনের")
        with self.assertRaises(ValueError):
            genitivo_bn("Moses")

    def test_elisao_fr(self):
        self.assertEqual(elisao_fr("fils de Abraham"), "fils d'Abraham")
        self.assertEqual(elisao_fr("De Élie"), "D'Élie")
        self.assertEqual(elisao_fr("de Hébron"), "d'Hébron")
        self.assertEqual(elisao_fr("de Hénoc"), "d'Hénoc")
        self.assertEqual(elisao_fr("De Hérode"), "D'Hérode")
        self.assertEqual(elisao_fr("de Hanoch"), "d'Hanoch")
        self.assertEqual(elisao_fr("de hauteur"), "de hauteur")  # h minúsculo não elide
        self.assertEqual(elisao_fr("de Hl"), "de Hl")  # H sem vogal depois não elide
        self.assertEqual(elisao_fr("fils de la femme"), "fils de la femme")


class AbreviaturasTest(unittest.TestCase):
    def test_pt_do_nucleo(self):
        pt = abreviaturas("pt")
        self.assertEqual(len(pt), 66)
        self.assertEqual(pt[:3], ["Gn", "Êx", "Lv"])
        self.assertEqual(pt[-1], "Ap")

    def test_idioma_sem_tabela_usa_ingles(self):
        self.assertEqual(abreviaturas("xx"), abreviaturas("en"))

    def test_ref_com_tabela_da_lingua(self):
        self.assertEqual(ref_pt("Exo.4.14", abreviaturas("ru")), "Исх 4:14")
        self.assertEqual(ref_pt("Psa.120.5"), "Sl 120:5")
        self.assertIsNone(ref_pt("Xyz.1.1", abreviaturas("ru")))


class GlossarioEGramaticaTest(unittest.TestCase):
    def test_coluna_genero(self):
        g = ler_glossario("cargo\twoman\tmulher\t\tf\ncargo\tman\thomem\t\t\n")
        self.assertEqual(g["cargo"]["woman"].genero, "f")
        self.assertEqual(g["cargo"]["man"].genero, "")
        self.assertEqual(g["cargo"]["woman"], "mulher")

    def test_genero_invalido(self):
        with self.assertRaisesRegex(ValueError, "gênero"):
            ler_glossario("cargo\twoman\tmulher\t\tx\n")

    def test_gramatica_do_tsv(self):
        g = ler_gramatica("chave\tmodelo\ncabecalho\t{frase}{pont..}\n")
        self.assertEqual(g, {"cabecalho": "{frase}{pont..}"})
        self.assertEqual(ler_gramatica(""), {})

    def test_gramatica_erros(self):
        with self.assertRaisesRegex(ValueError, "cabeçalho"):
            ler_gramatica("modelo\tchave\n")
        with self.assertRaisesRegex(ValueError, "repetida"):
            ler_gramatica("chave\tmodelo\na\tb\na\tc\n")
        with self.assertRaisesRegex(ValueError, "chave<TAB>modelo"):
            ler_gramatica("chave\tmodelo\na\tb\tc\n")

    def test_grammar_pt_inteira(self):
        # A gramática do pt tem todas as chaves que o código lê (nenhuma falta, nenhuma sobra).
        self.assertTrue({"cabecalho", "citacao", "lista_sep", "pont.;", "pont..", "pont.,"} <= set(GRAMATICA_PT))


class IngestorPorLinguaTest(unittest.TestCase):
    def test_tsv_por_lingua(self):
        chave = "0123456789abcdef"
        tsv = (f"chave\tfonte\tdescricao_es\torigem\tnota\n{chave}\ttheographic\tUn rey.\\nSegunda.\trevisado\trev. IA\n")
        r = ingestor.ler_tsv(tsv, "es")
        self.assertEqual(r[chave]["descricao_es"], "Un rey.\nSegunda.")

    def test_tsv_de_outra_lingua_com_cabecalho_do_pt_falha(self):
        with self.assertRaises(ValueError):
            ingestor.ler_tsv("chave\tfonte\tdescricao_pt\torigem\tnota\n", "es")


class AplicaRespostasTest(unittest.TestCase):
    """Validação das respostas dos agentes (ingest/aplica_descricoes.py): erro antes de gravar qualquer arquivo."""

    def test_cabecalho_reconhecido_por_lingua(self):
        self.assertEqual(aplica.tipo_da_resposta(["chave", "modelo"], "es"), "gramatica")
        self.assertEqual(aplica.tipo_da_resposta(["chave", "fonte", "descricao_ru", "origem", "nota"], "ru"), "prosa")
        with self.assertRaises(aplica.Invalida):
            aplica.tipo_da_resposta(["chave", "fonte", "descricao_pt", "origem", "nota"], "ru")

    def test_gramatica_chave_e_campo_desconhecidos(self):
        with self.assertRaises(aplica.Invalida):
            aplica.valida_gramatica("r.tsv", [(2, ["chave_inventada", "x"])])
        with self.assertRaises(aplica.Invalida):
            aplica.valida_gramatica("r.tsv", [(2, ["cabecalho", "{frase} {campo_inventado}"])])
        self.assertEqual(aplica.valida_gramatica("r.tsv", [(2, ["comp_tribo.f", "{tribo} गोत्र की"])]),
                         {"comp_tribo.f": "{tribo} गोत्र की"})

    def test_glossario_geo_e_descricoes_nao_se_misturam(self):
        with self.assertRaises(aplica.Invalida):
            aplica.valida_glossario("r.tsv", [(2, ["tipo", "river", "rio", "", ""]),
                                              (3, ["cargo", "man", "homem", "", "m"])])
        alvo, _ = aplica.valida_glossario("r.tsv", [(2, ["tipo", "river", "rio", "", ""])])
        self.assertEqual(alvo, "geo")

    def test_glossario_genero_invalido(self):
        with self.assertRaises(aplica.Invalida):
            aplica.valida_glossario("r.tsv", [(2, ["cargo", "man", "homem", "", "x"])])

    def test_prosa_origem_invalida(self):
        with self.assertRaises(aplica.Invalida):
            aplica.valida_prosa("r.tsv", [(2, ["0123456789abcdef", "theographic", "x", "rascunho", ""])], "es")

    def test_resposta_com_campos_a_mais(self):
        with self.assertRaises(aplica.Invalida):
            aplica.le_resposta("r.tsv", "chave\tmodelo\na\tb\tc\n", "es")

    def test_texto_fora_de_nfc(self):
        decomposto = "Cafe\u0301"  # e + acento combinante, fora de NFC
        with self.assertRaises(aplica.Invalida):
            aplica.le_resposta("r.tsv", f"chave\tmodelo\n{decomposto}\tx\n", "es")


if __name__ == "__main__":
    unittest.main()
