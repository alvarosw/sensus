"""Testes da base multilíngue (C1): nomes marcados com \\pn no USFM, caminhos de correções e línguas.

Funções puras, com casos do AT (Êx 1:1, hebraico) e do NT (Mt 1:2, grego), linhas reais da Bíblia zh (cmncbs).

Rodar a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "ingest"))

import ebible  # noqa: E402
from sensus import correcoes, linguas  # noqa: E402

# Linhas cruas do USFM (cmncbs), como chegam ao parser: \pn ... \pn* marca o nome; \f ... \f* é nota.
EXO_1_1 = (r"\v 1  \pn 以色列\pn*的众子带着家眷跟\pn 雅各\pn*\f + \fr 1:1 \ft “雅各”就是“以色列”，上帝为雅各改名以色列，"
           r"故事参考\xt 创世记32:28\ft 。\f*一起去了\pn 埃及\pn*，以下是他们的名字：  ")
MAT_1_2 = [r"\v 2  \pn 亚伯拉罕\pn*生\pn 以撒\pn*， ",
           r"\li1  \pn 以撒\pn*生\pn 雅各\pn*， ",
           r"\li1  \pn 雅各\pn*生\pn 犹大\pn*和他的兄弟， ",
           r"\li1  "]


class NomesMarcadosTest(unittest.TestCase):
    def test_exodo_1_1_at_hebraico(self):
        self.assertEqual(ebible.nomes_marcados(EXO_1_1), ["以色列", "雅各", "埃及"])

    def test_mateus_1_2_nt_grego(self):
        # O versículo ocupa quatro linhas USFM (\v e \li1); os nomes saem na ordem do texto.
        self.assertEqual(ebible.nomes_marcados(" ".join(MAT_1_2)),
                         ["亚伯拉罕", "以撒", "以撒", "雅各", "雅各", "犹大"])

    def test_sem_marcas_devolve_lista_vazia(self):
        self.assertEqual(ebible.nomes_marcados(r"\v 3 Texto comum, sem nome marcado."), [])

    def test_pn_dentro_de_nota_nao_conta(self):
        self.assertEqual(ebible.nomes_marcados(r"\v 4 \f + \fr 1:4 \ft \pn Falso\pn*\f* texto"), [])

    def test_parse_usfm_guarda_nomes_por_versiculo_sem_mudar_o_texto(self):
        usfm = "\\id EXO\n\\c 1\n" + EXO_1_1 + "\n\\v 2 Texto sem nome.\n"
        p = ebible.parse_usfm(usfm)
        self.assertEqual(p["nomes"], [(1, 1, ["以色列", "雅各", "埃及"])])
        texto = dict(((c, v), t) for c, v, t in p["verses"])
        # O texto segue o de antes (\pn vira espaço, espaços espúrios incluídos): verse_text.jsonl não muda nesta etapa.
        self.assertEqual(texto[(1, 1)], "以色列的众子带着家眷跟 雅各 一起去了 埃及，以下是他们的名字：")


class CaminhosTest(unittest.TestCase):
    def test_pt_usa_os_arquivos_legados(self):
        self.assertEqual(correcoes.caminho("pt", "nomes"), correcoes.CORRECOES / "nomes-pt.tsv")
        self.assertEqual(correcoes.caminho("pt", "nomes-revisao"), correcoes.CORRECOES / "nomes-pt-revisao.tsv")
        self.assertEqual(correcoes.caminho("pt", "descricoes"), correcoes.CORRECOES / "descricoes-pt.tsv")

    def test_outra_lingua_usa_pasta_propria(self):
        self.assertEqual(correcoes.caminho("es", "nomes"), correcoes.CORRECOES / "es" / "nomes.tsv")
        self.assertEqual(correcoes.caminho("zh", "gramatica-descricoes"),
                         correcoes.CORRECOES / "zh" / "gramatica-descricoes.tsv")

    def test_tipo_ou_lingua_desconhecidos_falham(self):
        with self.assertRaises(ValueError):
            correcoes.caminho("es", "nomes-xyz")
        with self.assertRaises(ValueError):
            correcoes.caminho("en", "nomes")


class LinguasTest(unittest.TestCase):
    def test_cada_lingua_tem_nome_e_biblia_de_referencia(self):
        pt_e_linguas = {"pt", *linguas.LINGUAS}
        self.assertEqual(set(linguas.BIBLIA_NOMES), pt_e_linguas)
        self.assertEqual(set(linguas.NOME_PT), pt_e_linguas)
        self.assertEqual(len(linguas.LINGUAS), 12)

    def test_indtsi_esta_no_catalogo_auxiliar_com_o_codigo_ebible(self):
        aux = {e["id"]: e for e in ebible.load_catalog(ebible.CATALOG_AUX)}
        self.assertEqual(aux["indtsi"]["ebible"], "ind")
        self.assertEqual(aux["indtsi"]["lang"], "id")


if __name__ == "__main__":
    unittest.main()
