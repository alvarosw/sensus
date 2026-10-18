"""Testes de sensus/names_pt.py (nomes próprios em português). Regra nova = caso de AT hebraico e de NT grego.

Os versículos são trechos curtos da Bíblia Livre (BLIVRE, CC BY 3.0 BR), usados só como caso de teste.
Rodar a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.names_pt import (  # noqa: E402
    avalia, base_name, candidates, choose, confianca, decompoe, escolhe_frase, gentilico, similarity, skel, split_name,
)

# AT (hebraico): Levítico 10:1 (Abihu) e Juízes 4:6 (Barak).
LV_10_1 = (3010001, "E os filhos de Arão, Nadabe e Abiú, tomaram cada um seu incensário, e puseram fogo neles, "
                    "sobre o qual puseram incenso, e ofereceram diante do SENHOR fogo estranho, que ele nunca lhes mandou.")
JZ_4_6 = (7004006, "E ela mandou chamar a Baraque filho de Abinoão, de Quedes de Naftali, e disse-lhe: Não te mandou "
                   "o SENHOR Deus de Israel, dizendo: Vai, e ajunta gente no monte de Tabor, e toma contigo dez mil "
                   "homens dos filhos de Naftali, e dos filhos de Zebulom:")
# NT (grego): Romanos 16:14 (Asyncritus).
RM_16_14 = (45016014, "Saudai Asíncrito, Flegonte, Hermas, Pátrobas, Hermes e os irmãos que estão com eles.")
# Dois Noahs: Gênesis 5:29 (Noé, pai de Lameque) e Números 26:33 (Noa, filha de Zelofeade).
GN_5_29 = (1005029, "E chamou seu nome Noé, dizendo: Este nos aliviará de nossas obras, e do trabalho de nossas mãos, "
                    "por causa da terra que o SENHOR amaldiçoou.")
NM_26_33 = (4026033, "E Zelofeade, filho de Héfer, não teve filhos somente filhas: e os nomes das filhas de Zelofeade "
                     "foram Maalá, e Noa, e Hogla, e Milca, e Tirza.")


def _escolhe(name, versos, fundo=()):
    """Escolhe o nome pt com df calculado sobre `versos` mais `fundo` (textos extras do corpus)."""
    textos = dict(versos) | {10_000_000 + i: t for i, t in enumerate(fundo)}
    vc = {v: candidates(t) for v, t in textos.items()}
    df = Counter(c for s in vc.values() for c in s)
    return choose(name, [v for v, _ in versos], vc, df)


class NomeBaseTest(unittest.TestCase):
    def test_sufixo_numerico_e_separado(self):
        self.assertEqual(split_name("Achzib 2"), ("Achzib", " 2"))
        self.assertEqual(base_name("Achzib 2"), "Achzib")
        self.assertEqual(split_name("Achzib"), ("Achzib", ""))

    def test_parenteses_saem_do_nome(self):
        self.assertEqual(base_name("Joktan (son of Eber)"), "Joktan")
        self.assertEqual(split_name("Abel (son of Adam) 2"), ("Abel", " 2"))

    def test_compostos_e_nao_proprios_ficam_fora(self):
        for ruim in ["Mount Sinai", "Valley of Elah", "Holy Spirit", "Mount Sinai (mountain)",
                     "some_thing", "lowercase", ""]:
            with self.subTest(nome=ruim):
                self.assertIsNone(base_name(ruim))

    def test_hifen_nao_e_composto(self):
        self.assertEqual(base_name("Taanath-shiloh"), "Taanath-shiloh")


class GrafiaTest(unittest.TestCase):
    def test_esqueleto_iguala_grafias_parecidas(self):
        self.assertEqual(skel("Abihu"), skel("Abiú"))
        self.assertEqual(skel("Barak"), "barac")

    def test_semelhanca(self):
        # 'que' final não vira 'c' no esqueleto: Barak/Baraque fica em 0.91, acima do limiar de alta.
        self.assertGreaterEqual(similarity("Barak", "Baraque"), 0.9)
        self.assertGreaterEqual(similarity("Asyncritus", "Asíncrito"), 0.8)
        self.assertLess(similarity("Abihu", "Deus"), 0.6)

    def test_candidatos_do_versiculo(self):
        cands = candidates(LV_10_1[1])
        self.assertIn("Abiú", cands)
        self.assertIn("Arão", cands)
        self.assertNotIn("sobre", cands)  # minúscula não é candidata


class EscolhaTest(unittest.TestCase):
    def test_at_hebraico_abihu(self):
        e = _escolhe("Abihu", [LV_10_1])
        self.assertEqual(e.nome, "Abiú")
        self.assertEqual(e.confianca, "alta")

    def test_at_hebraico_barak(self):
        e = _escolhe("Barak", [JZ_4_6])
        self.assertEqual(e.nome, "Baraque")
        self.assertEqual(e.confianca, "alta")

    def test_nt_grego_asyncritus(self):
        e = _escolhe("Asyncritus", [RM_16_14])
        self.assertEqual(e.nome, "Asíncrito")
        self.assertEqual(e.confianca, "alta")

    def test_mesmo_nome_ingles_duas_pessoas(self):
        # Noah é Noé em Gênesis e Noa em Números. Por entidade (versículos próprios), cada um tem o seu candidato.
        self.assertEqual(_escolhe("Noah", [GN_5_29]).nome, "Noé")
        self.assertEqual(_escolhe("Noah", [NM_26_33]).nome, "Noa")

    def test_segunda_via_tiago(self):
        # James -> Tiago: grafia diferente (0.4), mas o nome aparece em todos os versículos e Tiago é raro.
        v = [(i, "Tiago e João disseram.") for i in range(1, 7)]
        # Corpus: Tiago aparece em 8 versículos, João em 136 (como no texto real: João é bem mais comum).
        fundo = ["Tiago reinou." for _ in range(2)] + ["João falou." for _ in range(130)]
        e = _escolhe("James", v, fundo=fundo)
        self.assertEqual(e.nome, "Tiago")
        self.assertLess(e.semelhanca, 0.8)
        self.assertEqual(e.confianca, "alta")

    def test_gentilico_nunca_e_alta(self):
        # 'Silonitas' (gentílico): a Bíblia Livre escreve em minúscula; o candidato sai ruim e fica para revisão.
        e = _escolhe("Shilonites", [(1, "Siloni é uma cidade. Silonitas e Siloni.")])
        self.assertEqual(e.confianca, "baixa")

    def test_candidato_comum_perde_por_especificidade(self):
        # 'Abia' combina com 'Abiu' na grafia e aparece nos mesmos versículos, mas é comum no corpus
        # (como Deus ou SENHOR): perde para 'Abiú', que é raro.
        v1 = (1, "E Abiú e Abia subiram.")
        v2 = (2, "Então Abiú falou.")
        fundo = ["Abia reinou." for _ in range(200)]
        e = _escolhe("Abiu", [v1, v2], fundo)
        self.assertEqual(e.nome, "Abiú")
        self.assertEqual(e.alternativa, "Abia")
        self.assertEqual(e.especificidade, 1.0)  # Abiú só aparece nestes versículos

    def test_sem_versiculo_nao_escolhe(self):
        e = choose("Foo", [999], {}, Counter())
        self.assertIsNone(e.nome)
        self.assertEqual((e.confianca, e.versos), ("baixa", 0))

    def test_nome_pt_sem_relacao_fica_baixa(self):
        e = _escolhe("Adramyttium", [(1, "Ásia e Sur e Judá.")])
        self.assertEqual(e.confianca, "baixa")


class ConfiancaTest(unittest.TestCase):
    def test_limiares(self):
        self.assertEqual(confianca("Kittim", 0.8, 0.5, 0.3, 4), "alta")
        self.assertEqual(confianca("Kittim", 0.8, 0.49, 0.3, 4), "media")  # cobertura abaixo de 0.5
        self.assertEqual(confianca("Kittim", 0.8, 0.5, 0.29, 4), "media")  # especificidade abaixo de 0.3
        self.assertEqual(confianca("Kittim", 0.6, 0.0, 0.0, 4), "media")
        self.assertEqual(confianca("Kittim", 0.59, 1.0, 1.0, 4), "baixa")

    def test_segunda_via_exige_cinco_versos_e_especificidade(self):
        # grafia diferente (0.4) só vira alta com >= 5 versículos, cobertura >= 0.85 e especificidade >= 0.5
        self.assertEqual(confianca("James", 0.4, 0.97, 1.0, 38), "alta")    # James -> Tiago, valores reais
        self.assertEqual(confianca("James", 0.4, 0.97, 1.0, 4), "baixa")    # poucos versículos
        self.assertEqual(confianca("James", 0.4, 0.84, 0.9, 20), "baixa")   # cobertura baixa
        self.assertEqual(confianca("James", 0.4, 0.97, 0.49, 20), "baixa")  # especificidade baixa (ex.: SENHOR, Israel)
        self.assertEqual(confianca("James", 0.19, 1.0, 1.0, 20), "baixa")   # grafia sem relação

    def test_avalia_candidato_fixo(self):
        vc = {v: {"Tiago", "João"} for v in range(1, 7)}
        df = Counter({"Tiago": 8, "João": 6})
        e = avalia("James", "Tiago", range(1, 7), vc, df)
        self.assertEqual((e.nome, e.versos, e.cobertura), ("Tiago", 6, 1.0))
        self.assertEqual(e.confianca, "alta")

    def test_gentilico_rebaixado_a_baixa(self):
        self.assertTrue(gentilico("Shilonites"))
        self.assertTrue(gentilico("Hachmonites"))
        self.assertTrue(gentilico("Arkite"))
        self.assertEqual(confianca("Shilonites", 1.0, 1.0, 1.0, 10), "baixa")
        self.assertEqual(confianca("Hachmonites", 0.9, 0.9, 0.9, 10), "baixa")

    def test_nomes_com_ite_que_nao_sao_gentilicos(self):
        for nome in ["Kittim", "Ludim", "Elam", "Zerubbabel"]:
            with self.subTest(nome=nome):
                self.assertFalse(gentilico(nome))
        self.assertEqual(confianca("Ludim", 0.9, 0.9, 0.9, 4), "alta")


# Glossário reduzido (as formas reais estão em pipeline/ingest/corrections/glossario-compostos.tsv).
GLOSSARIO = {
    "Mount": ("monte", "monte de", "monte das"),
    "Mount of": ("monte de", "monte das"),
    "Valley of": ("vale de", "vale do"),
    "Gate": ("porta", "porta dos", "porta de"),
    "Gate of": ("porta de", "porta do"),
    "Sea of": ("mar de", "mar do"),
    "Sea": ("mar",),
    "Wilderness of": ("deserto de",),
}
# AT (hebraico): 1 Samuel 17:2 e 17:19 (vale de Elá). NT (grego): Mateus 21:1 e 24:3 (monte das Oliveiras).
SM_17_2 = (9017002, "E também Saul e os homens de Israel se juntaram, e assentaram o acampamento no vale de Elá, "
                    "e ordenaram a batalha contra os filisteus.")
SM_17_19 = (9017019, "E Saul e eles e todos os de Israel, estavam no vale de Elá, lutando com os filisteus.")
MT_21_1 = (40021001, "E quando se aproximaram de Jerusalém, e chegaram a Betfagé, ao monte das Oliveiras, então Jesus "
                     "mandou dois discípulos, dizendo-lhes:")
MT_24_3 = (40024003, "E, depois de se assentar no monte das Oliveiras, os discípulos se aproximaram dele reservadamente, "
                     "perguntando: Dize-nos, quando serão estas coisas, e que sinal haverá da tua vinda, e do fim da era?")


class CompostoDecomposicaoTest(unittest.TestCase):
    def test_cabeca_antes_do_nucleo(self):
        c = decompoe("Mount Sinai", GLOSSARIO)
        self.assertEqual((c.cabeca, c.nucleo, c.base, c.sufixo), ("Mount", "Sinai", "Mount Sinai", ""))

    def test_of(self):
        c = decompoe("Valley of Elah", GLOSSARIO)
        self.assertEqual((c.cabeca, c.nucleo), ("Valley of", "Elah"))
        c = decompoe("Mount of Olives", GLOSSARIO)  # NT: monte das Oliveiras
        self.assertEqual((c.cabeca, c.nucleo), ("Mount of", "Olives"))

    def test_nucleo_antes_da_cabeca_e_underscore(self):
        c = decompoe("Fish Gate", GLOSSARIO)
        self.assertEqual((c.cabeca, c.nucleo), ("Gate", "Fish"))
        c = decompoe("Gilboa_Mount", GLOSSARIO)
        self.assertEqual((c.cabeca, c.nucleo, c.base), ("Mount", "Gilboa", "Gilboa Mount"))

    def test_artigo_possessivo_e_sufixo(self):
        self.assertEqual(decompoe("Sea of the Philistines", GLOSSARIO).nucleo, "Philistines")
        self.assertEqual(decompoe("Benjamin's Gate", GLOSSARIO).nucleo, "Benjamin")
        c = decompoe("City of Palms 2", {"City of": ("cidade de",), **GLOSSARIO})
        self.assertEqual((c.base, c.sufixo), ("City of Palms", " 2"))

    def test_descritivo_de_pessoa_e_nao_proprio_ficam_fora(self):
        for ruim in ["Wife of Simon", "Mother of Lemuel", "a_wife_of_Lot", "Holy Spirit", "Most Holy",
                     "Gate of the Children of the People", "Valley of the Son of Hinnom"]:
            with self.subTest(nome=ruim):
                self.assertIsNone(decompoe(ruim, GLOSSARIO))


class FraseTest(unittest.TestCase):
    def test_at_frase_achada_com_nucleo_pt(self):
        textos = dict([SM_17_2, SM_17_19])
        f = escolhe_frase(GLOSSARIO["Valley of"], "Elah", "Elá", [SM_17_2[0], SM_17_19[0]], textos)
        self.assertEqual((f.candidato, f.achados, f.confianca), ("vale de Elá", 2, "alta"))

    def test_nt_frase_capturada_do_texto_com_grafia_parecida(self):
        # Olives não tem nome pt próprio: 'das Oliveiras' é capturado no texto e 'Oliveiras' se parece com 'Olives'.
        textos = dict([MT_21_1, MT_24_3])
        f = escolhe_frase(GLOSSARIO["Mount of"], "Olives", None, [MT_21_1[0], MT_24_3[0]], textos)
        self.assertEqual((f.candidato, f.confianca), ("monte das Oliveiras", "alta"))

    def test_frase_nao_achada_fica_baixa(self):
        textos = {1: "E foi a cidade de Nínive.", 2: "E ele disse."}
        f = escolhe_frase(GLOSSARIO["Mount"], "Foo", None, [1, 2], textos)
        self.assertEqual((f.candidato, f.achados, f.confianca), ("monte Foo", 0, "baixa"))

    def test_achada_em_menos_da_metade_fica_media(self):
        textos = {1: "E subiu ao monte Sinai.", 2: "E ele falou.", 3: "E ele voltou."}
        f = escolhe_frase(GLOSSARIO["Mount"], "Sinai", "Sinai", [1, 2, 3], textos)
        self.assertEqual((f.candidato, f.achados, f.confianca), ("monte Sinai", 1, "media"))

    def test_um_ou_dois_versos_basta_um(self):
        textos = {1: "E subiu ao monte Sinai.", 2: "E ele falou."}
        f = escolhe_frase(GLOSSARIO["Mount"], "Sinai", "Sinai", [1, 2], textos)
        self.assertEqual(f.confianca, "alta")

    def test_nucleo_de_grafia_diferente_sem_nome_pt_fica_media(self):
        # 'Red' não se parece com 'Vermelho': a frase é achada em todos os versos, mas não vira alta sem nome pt.
        textos = {1: "e chegaram ao mar Vermelho.", 2: "e atravessaram o mar Vermelho."}
        f = escolhe_frase(GLOSSARIO["Sea"], "Red", None, [1, 2], textos)
        self.assertEqual((f.candidato, f.confianca), ("mar Vermelho", "media"))

    def test_capturado_com_outro_nome_nao_vira_alta(self):
        # Baal-hermon -> 'monte Líbano' é frase literal, mas outro lugar: grafia distante, então média.
        textos = {1: "desde o monte Líbano até o vale."}
        f = escolhe_frase(GLOSSARIO["Mount"], "Baal-hermon", None, [1], textos)
        self.assertEqual((f.candidato, f.confianca), ("monte Líbano", "media"))

    def test_frase_nao_pega_palavra_maior(self):
        # 'monte Sinai' com núcleo pt 'Sinai' não pode casar com 'monte Sinaiticum'.
        textos = {1: "e subiu ao monte Sinaiticum."}
        f = escolhe_frase(GLOSSARIO["Mount"], "Sinai", "Sinai", [1], textos)
        self.assertEqual(f.candidato, "monte Sinaiticum")  # a palavra inteira é a que vale, não 'monte Sinai'

    def test_maiusculas_nao_importam_e_acento_importa(self):
        textos = {1: "no VALE DE ELÁ"}  # caixa alta não conta como diferença
        f = escolhe_frase(GLOSSARIO["Valley of"], "Elah", "Elá", [1], textos)
        self.assertEqual(f.achados, 1)
        # Sem acento, 'vale de Ela' não casa com o texto 'vale de Elá'; a frase achada é a do texto.
        f = escolhe_frase(GLOSSARIO["Valley of"], "Elah", "Ela", [1], {1: "no vale de Elá."})
        self.assertEqual(f.candidato, "vale de Elá")


if __name__ == "__main__":
    unittest.main()
