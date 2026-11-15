"""Testes de pipeline/ingest/aplica_nomes.py: validação da resposta dos agentes e gravação nos TSV da língua.

Os TSV de teste ficam em pasta temporária (caminho() é trocado por mock): nada da pasta corrections/ é tocado.
Rodar a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "ingest"))

import aplica_nomes as A  # noqa: E402
import nomes as N  # noqa: E402

CAB = "nome_en\tcandidato\tnome_es\torigem\tnota"
NOTA = "rev. IA: Lv 10:1 es 'Abiú'; candidato 'Nadab' era outro filho"


class ValidaRespostaTest(unittest.TestCase):
    def test_aceita_revisado_e_sem(self):
        texto = f"{CAB}\nAbihu\tNadab\tAbiú\trevisado\t{NOTA}\nAdramyttium\tAristarco\t\tsem\trev. IA: sem nome\n"
        tipo, linhas = A.valida_resposta(texto, "es")
        self.assertEqual(tipo, "revisao")
        self.assertEqual([r["origem"] for r in linhas], ["revisado", "sem"])

    def test_erro_com_numero_da_linha_para_origem_invalida(self):
        texto = f"{CAB}\nAbihu\tNadab\tAbiú\trevisdo\t{NOTA}\n"
        with self.assertRaises(ValueError) as ctx:
            A.valida_resposta(texto, "es")
        self.assertIn("linha 2", str(ctx.exception))

    def test_nome_fora_da_escrita_da_lingua_e_recusado(self):
        # AT hebraico escrito em cirílico: a resposta de espanhol não aceita (escrita_ok)
        texto = f"{CAB}\nAbihu\tNadab\tАбиу\trevisado\t{NOTA}\n"
        with self.assertRaises(ValueError):
            A.valida_resposta(texto, "es")

    def test_revisado_sem_nome_e_nota_sem_prefixo_sao_recusados(self):
        with self.assertRaises(ValueError):
            A.valida_resposta(f"{CAB}\nAbihu\tNadab\t\trevisado\t{NOTA}\n", "es")
        with self.assertRaises(ValueError):
            A.valida_resposta(f"{CAB}\nAbihu\tNadab\tAbiú\trevisado\tcerto\n", "es")

    def test_cabecalho_de_manual_e_reconhecido_e_outro_e_recusado(self):
        manual = "nome_en\ttipo\tnome_es\torigem\tnota\nNadab\tperson\tNadab\trevisado\trev. IA: Lv 10:1\n"
        tipo, _ = A.valida_resposta(manual, "es")
        self.assertEqual(tipo, "manual")
        with self.assertRaises(ValueError):
            A.valida_resposta("nome_en\tnome_pt\n", "es")


class AplicaTest(unittest.TestCase):
    def test_grava_revisado_no_tsv_e_nas_notas(self):
        with tempfile.TemporaryDirectory() as pasta:
            base = Path(pasta)
            tsv = base / "nomes.tsv"
            tsv.write_text(
                "# comentário\n" + "\t".join(N.colunas("es")) + "\n"
                "Abihu\tNadab\tNadab\tauto\tbaixa\t1\t2\t0.50\t\n"
                "Abel\tAbel\tAbel\tauto\talta\t1\t2\t1.00\t\n",
                encoding="utf-8",
            )
            resp = base / "resp.tsv"
            resp.write_text(f"{CAB}\nAbihu\tNadab\tAbiú\trevisado\t{NOTA}\n", encoding="utf-8")

            def caminho(lang, tipo):
                return {"nomes": tsv, "nomes-revisao": base / "rev.tsv",
                        "nomes-manuais": base / "man.tsv"}[tipo]

            with mock.patch.object(A, "caminho", caminho):
                contagem = A.aplica("es", [resp])
            self.assertEqual(contagem, {"revisao": 1, "manual": 0})
            linhas = {r["nome_en"]: r for r in N.ler_tsv(tsv, "es")}
            self.assertEqual(linhas["Abihu"]["nome_es"], "Abiú")
            self.assertEqual(linhas["Abihu"]["origem"], "revisado")
            self.assertEqual(linhas["Abel"]["origem"], "auto")  # linha fora da resposta fica como estava
            self.assertIn("Abiú", (base / "rev.tsv").read_text(encoding="utf-8"))

            # o ingestor preserva o revisado ao rodar de novo
            rows = N.ler_tsv(tsv, "es")
            self.assertEqual([r["origem"] for r in rows if r["nome_en"] == "Abihu"], ["revisado"])

    def test_chave_fora_do_tsv_nao_grava_nada(self):
        with tempfile.TemporaryDirectory() as pasta:
            base = Path(pasta)
            tsv = base / "nomes.tsv"
            tsv.write_text("\t".join(N.colunas("es")) + "\nAbel\tAbel\tAbel\tauto\talta\t1\t2\t1.00\t\n",
                           encoding="utf-8")
            resp = base / "resp.tsv"
            resp.write_text(f"{CAB}\nJonas\tJonás\tJonás\trevisado\t{NOTA}\n", encoding="utf-8")

            def caminho(lang, tipo):
                return {"nomes": tsv, "nomes-revisao": base / "rev.tsv",
                        "nomes-manuais": base / "man.tsv"}[tipo]

            with mock.patch.object(A, "caminho", caminho), self.assertRaises(ValueError):
                A.aplica("es", [resp])
            self.assertFalse((base / "rev.tsv").exists())


if __name__ == "__main__":
    unittest.main()
