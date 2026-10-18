"""Testes de sensus/titulos_pt.py (títulos dos eventos em português). Regra nova = caso de AT hebraico e de NT grego.

Eventos de exemplo (ids inventados, títulos da Theographic): Morte de Saul (AT, 1Sm 31) e Pedro encontra Cornélio
(NT, At 10). Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.titulos_pt import (  # noqa: E402
    COLUNAS, escolher_linhas, escrever_tsv, eventos_da_fonte, ler_tsv, mesclar,
)

SAUL = "ent:theographic:recSaulDeath"  # AT, eventID 158
CORNELIO = "ent:theographic:recCornelius"  # NT, eventID 329
SO_EVENTO = "ent:theographic:recFoiRemovido"  # sumiu da fonte


def evento(cite, event_id, en, sort_key):
    return {"event_id": event_id, "cite_id": cite, "titulo_en": en, "sort_key": sort_key}


def linha(cite, event_id, en, pt="", origem="rascunho", nota=""):
    return {"event_id": str(event_id), "cite_id": cite, "titulo_en": en, "titulo_pt": pt, "origem": origem,
            "nota": nota}


class FonteTest(unittest.TestCase):
    def test_so_eventos_em_ordem_cronologica_com_ids_do_data(self):
        registros = [
            {"cite_id": CORNELIO, "type": "event", "name": "Peter meets Cornelius",
             "data": json.dumps({"eventID": 329, "sortKey": 33000.5})},
            {"cite_id": "ent:theographic:recPessoa", "type": "person", "name": "Saul", "data": None},
            {"cite_id": SAUL, "type": "event", "name": "Death of Saul",
             "data": json.dumps({"eventID": 158, "sortKey": -1010.0})},
        ]
        eventos = eventos_da_fonte(registros)
        self.assertEqual([e["event_id"] for e in eventos], [158, 329])
        self.assertEqual(eventos[0]["titulo_en"], "Death of Saul")
        self.assertEqual(eventos[0]["cite_id"], SAUL)

    def test_cite_id_repetido_na_fonte_e_erro(self):
        registros = [
            {"cite_id": SAUL, "type": "event", "name": "A", "data": json.dumps({"eventID": 1, "sortKey": 0})},
            {"cite_id": SAUL, "type": "event", "name": "B", "data": json.dumps({"eventID": 2, "sortKey": 1})},
        ]
        with self.assertRaises(ValueError):
            eventos_da_fonte(registros)


class RegeneracaoTest(unittest.TestCase):
    def test_preserva_titulo_origem_e_nota_pela_chave_cite_id(self):
        eventos = [evento(SAUL, 158, "Death of Saul", -1010.0)]
        existentes = [linha(SAUL, 158, "Death of Saul", "Morte de Saul", "revisado", "conferido com 1Sm 31")]
        r = mesclar(eventos, existentes)
        self.assertEqual(r["linhas"], [{
            "event_id": "158", "cite_id": SAUL, "titulo_en": "Death of Saul", "titulo_pt": "Morte de Saul",
            "origem": "revisado", "nota": "conferido com 1Sm 31",
        }])
        self.assertEqual(r["novos"], [])

    def test_titulo_en_mudado_na_fonte_avisa_e_nao_mexe_no_pt(self):
        eventos = [evento(SAUL, 158, "Death of King Saul", -1010.0)]
        existentes = [linha(SAUL, 158, "Death of Saul", "Morte de Saul", "revisado")]
        r = mesclar(eventos, existentes)
        self.assertEqual(r["linhas"][0]["titulo_en"], "Death of King Saul")
        self.assertEqual(r["linhas"][0]["titulo_pt"], "Morte de Saul")
        self.assertEqual(r["linhas"][0]["origem"], "revisado")
        self.assertEqual(r["alterados"], ["158"])

    def test_evento_novo_entra_como_rascunho_sem_titulo(self):
        eventos = [evento(CORNELIO, 329, "Peter meets Cornelius", 33000.5)]
        r = mesclar(eventos, [])
        self.assertEqual(r["linhas"][0]["origem"], "rascunho")
        self.assertEqual(r["linhas"][0]["titulo_pt"], "")
        self.assertEqual(r["novos"], ["329"])

    def test_evento_sumido_fica_no_fim_e_e_avisado(self):
        eventos = [evento(SAUL, 158, "Death of Saul", -1010.0)]
        existentes = [
            linha(SO_EVENTO, 999, "Removed event", "Evento removido", "revisado"),
            linha(SAUL, 158, "Death of Saul", "Morte de Saul", "revisado"),
        ]
        r = mesclar(eventos, existentes)
        self.assertEqual([x["cite_id"] for x in r["linhas"]], [SAUL, SO_EVENTO])
        self.assertEqual(r["sumidos"], [("999", SO_EVENTO)])
        # o revisado sumido não vai para o banco, mesmo com título pt
        self.assertEqual(escolher_linhas(r["linhas"], {SAUL}), [(SAUL, "Morte de Saul")])


class BancoTest(unittest.TestCase):
    def test_so_revisado_com_titulo_e_evento_atual_vai_para_o_banco(self):
        linhas = [
            linha(SAUL, 158, "Death of Saul", "Morte de Saul", "rascunho"),  # rascunho: fora
            linha(CORNELIO, 329, "Peter meets Cornelius", "Pedro encontra Cornélio", "revisado"),  # entra
            linha("ent:theographic:recX", 1, "Creation", "Criação", "sem"),  # sem: fora
            linha("ent:theographic:recY", 2, "Fall", "", "revisado"),  # revisado sem título: fora
            linha(SO_EVENTO, 999, "Removed", "Evento removido", "revisado"),  # não está na fonte: fora
        ]
        atuais = {SAUL, CORNELIO, "ent:theographic:recX", "ent:theographic:recY"}
        self.assertEqual(escolher_linhas(linhas, atuais), [(CORNELIO, "Pedro encontra Cornélio")])

    def test_rascunho_nao_entra_mesmo_com_titulo_preenchido(self):
        linhas = [linha(SAUL, 158, "Death of Saul", "Morte de Saul", "rascunho")]
        self.assertEqual(escolher_linhas(linhas, {SAUL}), [])


class TsvTest(unittest.TestCase):
    def test_ida_e_volta_preserva_todas_as_colunas(self):
        linhas = [
            linha(SAUL, 158, "Death of Saul", "Morte de Saul", "revisado", "nota, com vírgula"),
            linha(CORNELIO, 329, "Peter meets Cornelius", "", "rascunho", ""),
        ]
        texto = escrever_tsv(linhas)
        self.assertEqual(texto.splitlines()[0], "\t".join(COLUNAS))
        self.assertEqual(ler_tsv(texto), linhas)

    def test_cabecalho_diferente_e_erro_para_nao_perder_revisao(self):
        with self.assertRaises(ValueError):
            ler_tsv("event_id\tcite_id\ttitulo_en\n158\t" + SAUL + "\tDeath of Saul\n")

    def test_origem_invalida_e_erro(self):
        texto = escrever_tsv([linha(SAUL, 158, "Death of Saul", "Morte de Saul", "aprovado")])
        with self.assertRaises(ValueError):
            ler_tsv(texto)

    def test_comentarios_e_linhas_em_branco_sao_ignorados(self):
        texto = "# cabeçalho explicativo\n\n" + escrever_tsv([linha(CORNELIO, 329, "Peter meets Cornelius")])
        self.assertEqual(len(ler_tsv(texto)), 1)


if __name__ == "__main__":
    unittest.main()
