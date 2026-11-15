"""Testes de ingest/sword_genbook.py (leitor RawGenBook do SWORD) com um módulo sintético.

O builder monta .idx, .dat e .bdt no layout do libsword: os registros vão ao .dat em ordem invertida, então
só os ponteiros (parent, next, firstChild) e o .idx dizem a ordem da árvore. Só biblioteca padrão.
Rodar a partir da pasta pipeline: python3 -m unittest discover -s tests
"""

import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.sword_genbook import read_genbook, walk  # noqa: E402


def monta(arvore):
    """arvore: lista de (nome, texto ou None, [filhos]). Devolve (idx, dat, bdt) como bytes do libsword."""
    nos = [{"nome": "", "texto": None, "pai": -1}]  # nó 0 = raiz
    filhos = {0: []}

    def coleta(lista, pai):
        for nome, texto, sub in lista:
            i = len(nos)
            nos.append({"nome": nome, "texto": texto, "pai": pai})
            filhos[pai].append(i)
            filhos[i] = []
            coleta(sub, i)

    coleta(arvore, 0)

    def chave(i):  # chave = deslocamento do nó no .idx (4 bytes por nó)
        return -1 if i is None else 4 * i

    bdt = b""
    user = {}
    for i, no in enumerate(nos):
        if no["texto"] is None:
            user[i] = b""
            continue
        dado = no["texto"].encode("utf-8")
        user[i] = struct.pack("<II", len(bdt), len(dado))
        bdt += dado

    registros = {}
    for i, no in enumerate(nos):
        irmaos = filhos[no["pai"]] if no["pai"] >= 0 else []
        k = irmaos.index(i) if i in irmaos else -1
        prox = irmaos[k + 1] if 0 <= k < len(irmaos) - 1 else None
        primeiro = filhos[i][0] if filhos[i] else None
        cab = struct.pack("<iii", chave(no["pai"]) if no["pai"] >= 0 else -1, chave(prox), chave(primeiro))
        corpo = no["nome"].encode("utf-8") + b"\0" + struct.pack("<H", len(user[i])) + user[i]
        registros[i] = cab + corpo

    # Registros no .dat em ordem invertida: só os ponteiros dizem a ordem da árvore.
    dat = b""
    posicao = {}
    for i in reversed(range(len(nos))):
        posicao[i] = len(dat)
        dat += registros[i]
    idx = b"".join(struct.pack("<I", posicao[i]) for i in range(len(nos)))
    return idx, dat, bdt


ARVORE = [
    ("Conteúdo", "Sumário.", []),
    ("WCF", None, [
        ("Capítulo I", "Da Escritura Sagrada, §1.", []),
        ("Capítulo II", "De Deus, §1.", [
            ("II.a", "Subitem em OSIS.", []),
        ]),
    ]),
    ("Fim", "Texto final com acentuação: Confissão.", []),
]


class TestWalk(unittest.TestCase):
    def test_percorre_em_pre_ordem_pelos_ponteiros(self):
        nos = walk(*monta(ARVORE))
        self.assertEqual([n.name for n in nos],
                         ["Conteúdo", "WCF", "Capítulo I", "Capítulo II", "II.a", "Fim"])
        self.assertEqual([n.depth for n in nos], [0, 0, 1, 1, 2, 0])

    def test_texto_vem_do_bdt_e_grupo_sem_texto_fica_vazio(self):
        nos = {n.name: n for n in walk(*monta(ARVORE))}
        self.assertEqual(nos["WCF"].text, "")
        self.assertEqual(nos["Capítulo I"].text, "Da Escritura Sagrada, §1.")
        self.assertEqual(nos["Fim"].text, "Texto final com acentuação: Confissão.")

    def test_registro_da_raiz_nao_fica_no_inicio_do_dat(self):
        # Layout de propósito fora da ordem da árvore: a raiz (nó 0) fica no fim do .dat.
        idx, _, _ = monta(ARVORE)
        self.assertGreater(struct.unpack_from("<I", idx, 0)[0], 0)

    def test_modulo_sem_nos_devolve_lista_vazia(self):
        self.assertEqual(walk(b"", b"", b""), [])

    def test_idx_com_tamanho_invalido_falha(self):
        idx, dat, bdt = monta(ARVORE)
        with self.assertRaises(ValueError):
            walk(idx[:-1], dat, bdt)

    def test_texto_fora_do_bdt_falha(self):
        idx, dat, bdt = monta(ARVORE)
        with self.assertRaises(ValueError):
            walk(idx, dat, bdt[:5])

    def test_ponteiro_fora_do_idx_falha(self):
        idx, dat, bdt = monta(ARVORE)
        # Aponta o primeiro filho da raiz para uma chave que não existe (nó 99).
        raiz_pos = struct.unpack_from("<I", idx, 0)[0]
        dat_ruim = bytearray(dat)
        struct.pack_into("<i", dat_ruim, raiz_pos + 8, 4 * 99)
        with self.assertRaises(ValueError):
            walk(idx, bytes(dat_ruim), bdt)


class TestReadGenbook(unittest.TestCase):
    def test_le_os_tres_arquivos_de_um_modulo(self):
        idx, dat, bdt = monta(ARVORE)
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "modulo" / "modulo"
            base.parent.mkdir()
            Path(str(base) + ".idx").write_bytes(idx)
            Path(str(base) + ".dat").write_bytes(dat)
            Path(str(base) + ".bdt").write_bytes(bdt)
            nos = read_genbook(base)
        self.assertEqual([n.name for n in nos],
                         ["Conteúdo", "WCF", "Capítulo I", "Capítulo II", "II.a", "Fim"])
        self.assertEqual(nos[-1].text, "Texto final com acentuação: Confissão.")


if __name__ == "__main__":
    unittest.main()
