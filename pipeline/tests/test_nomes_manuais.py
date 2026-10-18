"""Testes de sensus/names_pt.py ler_nomes_manuais (corrections/nomes-pt-manuais.tsv).

Casos: 'Daughter of Pharaoh' (AT, descritivo de pessoa) e 'Jesus Christ' (NT, composto de pessoa). Os nomes pt são
de teste. Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))

from sensus.names_pt import ler_nomes_manuais  # noqa: E402

CABECALHO = "nome_en\ttipo\tnome_pt\torigem\tnota\n"


class NomesManuaisTest(unittest.TestCase):
    def test_tsv_versionado_e_valido(self):
        # O arquivo versionado é lido sem erro e toda linha revisada tem nome pt.
        texto = (PIPELINE / "ingest" / "corrections" / "nomes-pt-manuais.tsv").read_text(encoding="utf-8")
        linhas = ler_nomes_manuais(texto)
        self.assertTrue(linhas)
        self.assertTrue(all(r["nome_pt"] for r in linhas.values() if r["origem"] == "revisado"))

    def test_revisado_e_sem_pela_chave(self):
        texto = (CABECALHO
                 + "Daughter of Pharaoh\tperson\tFilha do Faraó\trevisado\t1Rs 3:1\n"
                 + "Jesus Christ\tperson\tJesus Cristo\tREVISADO\t\n"
                 + "Jesus Christ\tother\tJesus Cristo\tsem\t\n")
        r = ler_nomes_manuais(texto)
        self.assertEqual(r[("Daughter of Pharaoh", "person")]["nome_pt"], "Filha do Faraó")
        self.assertEqual(r[("Jesus Christ", "person")]["origem"], "revisado")
        self.assertEqual(r[("Jesus Christ", "other")]["origem"], "sem")

    def test_comentarios_e_linhas_vazias_ignorados(self):
        texto = "# nota\n\n" + CABECALHO + "# outra nota\n\nSimon Peter\tperson\tSimão Pedro\trevisado\t\n"
        self.assertEqual(list(ler_nomes_manuais(texto)), [("Simon Peter", "person")])

    def test_erros(self):
        casos = {
            "origem auto": CABECALHO + "Jesus Christ\tperson\tJesus Cristo\tauto\t\n",
            "tipo inválido": CABECALHO + "Jesus Christ\tevent\tJesus Cristo\trevisado\t\n",
            "chave repetida": CABECALHO + "Jesus Christ\tperson\tJesus Cristo\trevisado\t\n"
                                          "Jesus Christ\tperson\tJesus\trevisado\t\n",
            "cabeçalho": "nome\ttipo\tnome_pt\torigem\tnota\n",
        }
        for nome, texto in casos.items():
            with self.subTest(nome):
                with self.assertRaises(ValueError):
                    ler_nomes_manuais(texto)


if __name__ == "__main__":
    unittest.main()
