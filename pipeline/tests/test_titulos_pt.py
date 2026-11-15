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
    COLUNAS, colunas, colunas_folha, escolher_linhas, escrever_tsv, eventos_da_fonte, faltando_no_titulo,
    formata_participantes, ler_folha, ler_participantes, ler_tsv, mesclar,
)

SAUL = "ent:theographic:recSaulDeath"  # AT, eventID 158
CORNELIO = "ent:theographic:recCornelius"  # NT, eventID 329
SO_EVENTO = "ent:theographic:recFoiRemovido"  # sumiu da fonte

# Eventos para lang="es" (ids inventados, títulos da Theographic): morte de Aarón (AT, Nm 20, eventID 166) e Pedro
# predica (NT, At 10, eventID 352). Participantes: Aarón (ent:theographic:recv0dAY2ULzJ687g, mesmo id do nome pt
# de teste), Moisés e Pedro.
AARON = "ent:theographic:recv0dAY2ULzJ687g"
MOISES = "ent:theographic:recMoisesEx"
PEDRO = "ent:theographic:recPeterPerson"
AARON_MORTE = "ent:theographic:recAaronDeath"
PEDRO_PREGA = "ent:theographic:recPeterPreaches"


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


class LinguaTest(unittest.TestCase):
    """Mesma regra para outra língua: o título fica na coluna titulo_<xx>; o pt segue igual."""

    def test_colunas_por_lingua(self):
        self.assertEqual(colunas("es"), ["event_id", "cite_id", "titulo_en", "titulo_es", "origem", "nota"])
        self.assertEqual(COLUNAS, colunas("pt"))

    def test_tsv_de_outra_lingua_nao_e_lido_como_outra(self):
        texto = escrever_tsv([linha(AARON_MORTE, 166, "Death of Aaron", "Muerte de Aarón", "revisado")], "pt")
        with self.assertRaises(ValueError):
            ler_tsv(texto, "es")

    def test_ida_e_volta_em_espanhol_com_titulo_es(self):
        linhas = [
            {"event_id": "166", "cite_id": AARON_MORTE, "titulo_en": "Death of Aaron", "titulo_es": "Muerte de Aarón",
             "origem": "revisado", "nota": "rev. IA"},
            {"event_id": "352", "cite_id": PEDRO_PREGA, "titulo_en": "Peter preaches", "titulo_es": "",
             "origem": "rascunho", "nota": ""},
        ]
        texto = escrever_tsv(linhas, "es")
        self.assertEqual(texto.splitlines()[0], "event_id\tcite_id\ttitulo_en\ttitulo_es\torigem\tnota")
        self.assertEqual(ler_tsv(texto, "es"), linhas)

    def test_regeneracao_em_espanhol_preserva_titulo_es(self):
        eventos = [evento(AARON_MORTE, 166, "Death of Aaron", -1400.0), evento(PEDRO_PREGA, 352, "Peter preaches", 33000.0)]
        existentes = [{"event_id": "166", "cite_id": AARON_MORTE, "titulo_en": "Death of Aaron",
                       "titulo_es": "Muerte de Aarón", "origem": "revisado", "nota": "rev. IA"}]
        r = mesclar(eventos, existentes, "es")
        self.assertEqual(r["linhas"][0]["titulo_es"], "Muerte de Aarón")
        self.assertEqual(r["linhas"][0]["origem"], "revisado")
        self.assertEqual(r["linhas"][1]["origem"], "rascunho")
        self.assertEqual(r["linhas"][1]["titulo_es"], "")
        self.assertEqual(r["novos"], ["352"])

    def test_so_revisado_em_espanhol_vai_para_o_banco(self):
        linhas = [
            {"event_id": "166", "cite_id": AARON_MORTE, "titulo_en": "Death of Aaron", "titulo_es": "Muerte de Aarón",
             "origem": "revisado", "nota": ""},  # AT: entra
            {"event_id": "352", "cite_id": PEDRO_PREGA, "titulo_en": "Peter preaches", "titulo_es": "Pedro predica",
             "origem": "rascunho", "nota": ""},  # NT, rascunho: fora
        ]
        atuais = {AARON_MORTE, PEDRO_PREGA}
        self.assertEqual(escolher_linhas(linhas, atuais, "es"), [(AARON_MORTE, "Muerte de Aarón")])

    def test_fonte_traz_participantes_e_referencia_em_ingles(self):
        registros = [
            {"cite_id": PEDRO_PREGA, "type": "event", "name": "Peter preaches",
             "data": json.dumps({"eventID": 352, "sortKey": 33000.0, "verseSort": "44010034", "participants": [
                 {"cite_id": PEDRO, "name": "Peter"}]})},
            {"cite_id": AARON_MORTE, "type": "event", "name": "Death of Aaron",
             "data": json.dumps({"eventID": 166, "sortKey": -1400.0, "verseSort": "04020028", "participants": [
                 {"cite_id": AARON, "name": "Aaron"}, {"cite_id": MOISES, "name": "Moses"}]})},
        ]
        eventos = eventos_da_fonte(registros)
        self.assertEqual(eventos[0]["cite_id"], AARON_MORTE)  # AT antes do NT, pela sortKey
        self.assertEqual(eventos[0]["ref"], "Num.20.28")
        self.assertEqual(eventos[0]["participantes"], [{"cite_id": AARON, "name": "Aaron"},
                                                        {"cite_id": MOISES, "name": "Moses"}])
        self.assertEqual(eventos[1]["ref"], "Acts.10.34")
        self.assertEqual(eventos[1]["participantes"], [{"cite_id": PEDRO, "name": "Peter"}])

    def test_participantes_sem_nome_na_lingua_ficam_vazios_e_nao_geram_aviso(self):
        pares = [("Aaron", "Aarón"), ("Moses", "")]
        texto = formata_participantes(
            [{"cite_id": AARON, "name": "Aaron"}, {"cite_id": MOISES, "name": "Moses"}], {AARON: "Aarón"})
        self.assertEqual(texto, "Aaron=Aarón; Moses=")
        self.assertEqual(ler_participantes(texto), pares)
        self.assertEqual(ler_participantes(""), [])
        self.assertEqual(faltando_no_titulo("Muerte de Aarón", pares), [])

    def test_aviso_quando_nome_do_participante_nao_aparece_no_titulo(self):
        pares = ler_participantes("Aaron=Aarón; Moses=Moisés")
        self.assertEqual(faltando_no_titulo("Muerte de Aarón", pares), ["Moisés"])
        self.assertEqual(faltando_no_titulo("Pedro predica", ler_participantes("Peter=Pedro")), [])

    def test_folha_tem_cabecalho_da_lingua_e_le_o_titulo_preenchido(self):
        self.assertEqual(colunas_folha("es"), ["event_id", "cite_id", "titulo_en", "titulo_pt", "participantes", "ref",
                                               "titulo_es", "nota"])
        texto = "\t".join(colunas_folha("es")) + "\n" + "\t".join(
            ["166", AARON_MORTE, "Death of Aaron", "Morte de Aarão", "Aaron=Aarón; Moses=", "Num.20.28",
             "Muerte de Aarón", ""]) + "\n"
        rows = ler_folha(texto, "es")
        self.assertEqual(rows[0]["titulo_es"], "Muerte de Aarón")
        self.assertEqual(rows[0]["ref"], "Num.20.28")
        with self.assertRaises(ValueError):
            ler_folha(texto, "pt")

    def test_pt_nao_muda_com_o_parametro_de_lingua_padrao(self):
        texto = escrever_tsv([linha(SAUL, 158, "Death of Saul", "Morte de Saul", "revisado")])
        self.assertEqual(ler_tsv(texto, "pt")[0]["titulo_pt"], "Morte de Saul")


class IngestTest(unittest.TestCase):
    """O ingestor, com a fonte e o TSV em pasta temporária (o staging de verdade não é tocado)."""

    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ingest"))
        import titulos as ingest_titulos
        cls.titulos = ingest_titulos

    def test_es_sem_tsv_grava_fonte_com_zero_linhas(self):
        import contextlib
        import io
        import tempfile
        from sensus import correcoes, staging

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            theo = tmp / "staging" / "theographic"
            theo.mkdir(parents=True)
            registros = [
                {"cite_id": AARON_MORTE, "type": "event", "name": "Death of Aaron",
                 "data": json.dumps({"eventID": 166, "sortKey": -1400.0, "verseSort": "04020028",
                                     "participants": []})},
            ]
            (theo / "entity.jsonl").write_text("\n".join(json.dumps(r) for r in registros) + "\n", encoding="utf-8")
            (theo / "source.json").write_text(json.dumps({
                "license": "CC-BY-SA-4.0", "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
                "url": "https://example.org", "version": "teste", "attribution": "teste",
            }), encoding="utf-8")
            antigo_staging, antigo_corr = staging.STAGING, correcoes.CORRECOES
            staging.STAGING, correcoes.CORRECOES = tmp / "staging", tmp / "corr"
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    self.titulos.main("es")
            finally:
                staging.STAGING, correcoes.CORRECOES = antigo_staging, antigo_corr

            source = json.loads((tmp / "staging" / "sensus-titulos-es" / "source.json").read_text(encoding="utf-8"))
            self.assertEqual(source["lang"], "es")
            self.assertEqual(source["id"], "sensus-titulos-es")
            self.assertFalse((tmp / "staging" / "sensus-titulos-es" / "entity_name.jsonl").exists())
            tsv = (tmp / "corr" / "es" / "titulos-eventos.tsv").read_text(encoding="utf-8")
            self.assertIn("titulo_es", tsv)
            self.assertIn("rascunho", tsv)

    def test_cabecalho_do_pt_continua_igual_ao_tsv_versionado(self):
        """Regressão: o TSV de títulos em português não pode mudar ao rodar o ingestor (git diff vazio)."""
        from sensus import correcoes
        arquivo = correcoes.caminho("pt", "titulos-eventos")
        cab = self.titulos.cabecalho("pt", "pipeline/ingest/titulos_pt.py")
        self.assertEqual(arquivo.read_text(encoding="utf-8").splitlines()[:len(cab)], cab)


if __name__ == "__main__":
    unittest.main()
