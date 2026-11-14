"""Leitor de módulos RawGenBook do SWORD (livros gerais com árvore de chaves). Só biblioteca padrão.

Formato (libsword 1.8.1, src/keys/treekeyidx.cpp e src/modules/genbook/rawgenbook/rawgenbook.cpp; inteiros
little-endian). Um módulo <base> tem três arquivos:
- <base>.idx: uma entrada uint32 por nó, com o deslocamento do registro do nó em <base>.dat. O nó de índice k
  tem chave 4*k (deslocamento dentro do .idx). Os ponteiros parent, next e firstChild são chaves; -1 = nenhum.
- <base>.dat: registros em sequência: int32 parent, int32 next, int32 firstChild, nome (UTF-8 terminado em \\0),
  uint16 dsize e userData (dsize bytes). Com dsize > 7, os 8 primeiros bytes do userData são uint32 offset e
  uint32 size do texto em <base>.bdt.
- <base>.bdt: textos concatenados (aqui, OSIS).

O nó 0 é a raiz (sem texto); a árvore é percorrida pelos ponteiros, não pela ordem dos registros no arquivo
(ex.: capítulos IX e IV do módulo westminster aparecem fora de ordem no .dat).

Uso (ex.): nos in = read_genbook('<raiz>/modules/genbook/rawgenbook/westminster/westminster')
"""

import struct
from dataclasses import dataclass
from pathlib import Path

NONE = -1
_HDR = struct.Struct("<iii")
_U16 = struct.Struct("<H")
_U32 = struct.Struct("<II")


@dataclass(frozen=True)
class GenBookNode:
    """Nó da árvore em ordem de percurso (pré-ordem). depth 0 = filho direto da raiz."""
    key: int
    depth: int
    name: str
    text: str  # '' quando o nó não tem texto (ex.: 'WCF', que só agrupa capítulos)


def parse_index(idx: bytes) -> list[int]:
    """Deslocamentos (uint32) dos registros do .dat, na ordem dos nós."""
    if len(idx) % 4:
        raise ValueError(f".idx com {len(idx)} bytes (não é múltiplo de 4)")
    return list(struct.unpack(f"<{len(idx) // 4}I", idx))


def parse_record(dat: bytes, pos: int) -> tuple[int, int, int, str, bytes]:
    """Lê o registro em pos: (parent, next, firstChild, nome, userData)."""
    if pos < 0 or pos + _HDR.size > len(dat):
        raise ValueError(f"registro fora do .dat: {pos}")
    parent, nxt, first = _HDR.unpack_from(dat, pos)
    end = dat.find(b"\0", pos + _HDR.size)
    if end < 0:
        raise ValueError(f"nome sem terminador no registro {pos}")
    name = _decode(dat[pos + _HDR.size:end])
    p = end + 1
    if p + _U16.size > len(dat):
        raise ValueError(f"registro truncado em {pos}")
    (dsize,) = _U16.unpack_from(dat, p)
    p += _U16.size
    user = dat[p:p + dsize]
    if len(user) != dsize:
        raise ValueError(f"userData truncado no registro {pos}")
    return parent, nxt, first, name, user


def node_text(bdt: bytes, user: bytes) -> str:
    """Texto do nó: o trecho de .bdt indicado pelo userData (libsword: só com dsize > 7)."""
    if len(user) <= 7:
        return ""
    off, size = _U32.unpack_from(user, 0)
    chunk = bdt[off:off + size]
    if len(chunk) != size:
        raise ValueError(f"texto fora do .bdt: offset {off}, size {size}")
    return _decode(chunk)


def walk(idx: bytes, dat: bytes, bdt: bytes) -> list[GenBookNode]:
    """Todos os nós abaixo da raiz, em pré-ordem: cada nó seguido de seus filhos, filhos na ordem do ponteiro next."""
    offsets = parse_index(idx)
    if not offsets:
        return []
    visitados: set[int] = {0}
    out: list[GenBookNode] = []

    def registro(key: int):
        if key < 0 or key % 4 or key // 4 >= len(offsets):
            raise ValueError(f"ponteiro inválido no .idx: {key}")
        return parse_record(dat, offsets[key // 4])

    def percorre(primeiro: int, depth: int) -> None:
        key = primeiro
        while key != NONE:
            if key in visitados:
                raise ValueError(f"ciclo na árvore de chaves no nó {key}")
            visitados.add(key)
            _, nxt, first, name, user = registro(key)
            out.append(GenBookNode(key, depth, name, node_text(bdt, user)))
            if first != NONE:
                percorre(first, depth + 1)
            key = nxt

    _, _, raiz_filho, _, _ = registro(0)
    if raiz_filho != NONE:
        percorre(raiz_filho, 0)
    return out


def read_genbook(base: Path | str) -> list[GenBookNode]:
    """Lê <base>.idx, <base>.dat e <base>.bdt e devolve os nós em pré-ordem."""
    base = str(base)
    return walk(
        Path(base + ".idx").read_bytes(),
        Path(base + ".dat").read_bytes(),
        Path(base + ".bdt").read_bytes(),
    )


def _decode(raw: bytes) -> str:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")
