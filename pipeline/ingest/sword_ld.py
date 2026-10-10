"""Leitor mínimo de módulos SWORD de dicionário/tópicos (ModDrv RawLD e zLD).

pysword só lê módulos Bíblia/comentário. Formatos (verificados nos módulos
CrossWire Easton, ISBE, Smith, Nave, Torrey, Hitchcock):

RawLD  (<base>.idx + <base>.dat)
    .idx: registros de 6 bytes  <uint32 offset, uint16 size>, ordenados por chave.
    .dat: cada entrada é "CHAVE\\r\\n" + corpo. Tamanho não inclui o \\r\\n final.

zLD    (<base>.idx, <base>.dat, <base>.zdx, <base>.zdt)
    .idx: registros de 8 bytes <uint32 offset, uint32 size> apontando para .dat.
    .dat: por chave: "CHAVE\\r\\n" + <uint32 bloco, uint32 índice> (8 bytes).
    .zdx: registros de 8 bytes <uint32 offset, uint32 size> para blocos zlib em .zdt.
    bloco descomprimido: <uint32 N> + N pares <uint32 offset, uint32 size>
    (offsets relativos ao início do bloco) + corpos das entradas.
"""

import html
import re
import struct
import zlib
from pathlib import Path


def read_conf(path: Path) -> dict:
    """Lê um .conf SWORD (primeira seção) como dict de chave=valor.

    Comentários (#) e linhas em branco são ignorados. Chaves repetidas (History_*)
    são mantidas apenas na primeira ocorrência, o que basta para os campos usados.
    """
    out: dict[str, str] = {}
    for raw in path.read_bytes().decode("utf-8", "replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            if out:
                break
            out["__section__"] = line[1:-1]
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            out.setdefault(k.strip(), v.strip())
    return out


def _find_conf(mods_root: Path) -> Path:
    confs = sorted((mods_root / "mods.d").glob("*.conf"))
    if len(confs) != 1:
        raise RuntimeError(f"esperado 1 .conf em {mods_root}/mods.d, achei {len(confs)}")
    return confs[0]


class LexDictModule:
    """Itera (chave, corpo_bruto) de um módulo RawLD ou zLD.

    mods_root: diretório que contém mods.d/ e modules/ (raiz da biblioteca SWORD).
    Para zLD, o corpo bruto é o XML/TEI da entrada; para RawLD é o texto ThML.
    """

    def __init__(self, mods_root: Path):
        self.root = Path(mods_root)
        self.conf = read_conf(_find_conf(self.root))
        self.drv = self.conf.get("ModDrv", "")
        if self.drv not in ("RawLD", "zLD"):
            raise ValueError(f"driver não suportado: {self.drv}")
        if self.conf.get("CompressType", "ZIP") not in ("ZIP", "") and self.drv == "zLD":
            raise ValueError(f"compressão não suportada: {self.conf.get('CompressType')}")
        self.base = self.root / self.conf["DataPath"].removeprefix("./")
        self.section = self.conf["__section__"]

    def entries(self):
        """Gera (chave, corpo_bruto_str) para cada entrada, na ordem do .idx."""
        if self.drv == "RawLD":
            yield from self._raw_entries()
        else:
            yield from self._zld_entries()

    # -- RawLD ---------------------------------------------------------------
    def _raw_entries(self):
        idx = Path(f"{self.base}.idx").read_bytes()
        dat = Path(f"{self.base}.dat").read_bytes()
        if len(idx) % 6:
            raise ValueError("idx RawLD com tamanho inválido")
        for i in range(len(idx) // 6):
            off, size = struct.unpack_from("<IH", idx, i * 6)
            chunk = dat[off:off + size]
            key, body = _split_key(chunk)
            yield key, body

    # -- zLD -----------------------------------------------------------------
    def _zld_entries(self):
        idx = Path(f"{self.base}.idx").read_bytes()
        dat = Path(f"{self.base}.dat").read_bytes()
        zdx = Path(f"{self.base}.zdx").read_bytes()
        zdt = Path(f"{self.base}.zdt").read_bytes()
        if len(idx) % 8 or len(zdx) % 8:
            raise ValueError("idx/zdx zLD com tamanho inválido")

        # (bloco, posição no bloco, chave) por entrada, na ordem do .idx
        located = []
        for i in range(len(idx) // 8):
            off, size = struct.unpack_from("<II", idx, i * 8)
            chunk = dat[off:off + size]
            key, _ = _split_key(chunk, keep_body=False)
            blk, pos = struct.unpack("<II", chunk[-8:])
            located.append((blk, pos, key))

        # Descomprime cada bloco uma única vez, agrupando as entradas por bloco.
        by_block: dict[int, list] = {}
        for blk, pos, key in located:
            by_block.setdefault(blk, []).append((pos, key))
        for blk in sorted(by_block):
            if blk * 8 + 8 > len(zdx):
                raise ValueError(f"bloco zLD {blk} fora do zdx")
            boff, bsize = struct.unpack_from("<II", zdx, blk * 8)
            data = zlib.decompressobj().decompress(zdt[boff:boff + bsize])
            n = struct.unpack_from("<I", data, 0)[0]
            for pos, key in by_block[blk]:
                if pos >= n:
                    raise ValueError(f"entrada {key!r} fora do bloco {blk}")
                eoff, esize = struct.unpack_from("<II", data, 4 + 8 * pos)
                yield key, _decode(data[eoff:eoff + esize])


def _split_key(chunk: bytes, keep_body: bool = True):
    """'CHAVE\\r\\n<corpo>' -> ('CHAVE', '<corpo>'). Aceita \\n puro como separador."""
    cut = chunk.find(b"\r\n")
    sep = 2
    if cut < 0:
        cut = chunk.find(b"\n")
        sep = 1
    if cut < 0:
        return chunk.decode("utf-8").strip(), ""
    key = _decode(chunk[:cut]).strip()
    body = _decode(chunk[cut + sep:]) if keep_body else ""
    return key, body


def _decode(b: bytes) -> str:
    """UTF-8; módulos antigos (Smith) trazem cp1252. Remove NULs de preenchimento."""
    try:
        s = b.decode("utf-8")
    except UnicodeDecodeError:
        s = b.decode("cp1252", "replace")
    return s.replace("\x00", "")


_TITLE = re.compile(r"<title\b[^>]*>.*?</title\s*>", re.S | re.I)
_LINE = re.compile(r"<(?:lb|br|item|li)\b[^>]*?/?>", re.I)
_PARA = re.compile(r"</?(?:p|def|list|ol|ul|div|entryFree|h\d)\b[^>]*?/?>", re.I)
_TAG = re.compile(r"<[^>]*>")


def to_plain(markup: str) -> str:
    """Corpo de verbete (TEI do zLD ou ThML do RawLD) -> texto puro.

    Parágrafos separados por "\\n\\n"; quebras de linha simples (<lb/>, <br/>, <item>)
    viram "\\n". <title> é descartado (repete a chave). Tags inline são removidas,
    mantendo o texto visível (de <ref>, <scripRef>, <i>, <term>...).
    """
    s = markup.replace("\r\n", "\n").replace("\r", "\n")
    s = _TITLE.sub("", s)
    s = _PARA.sub("\n\n", s)
    s = _LINE.sub("\n", s)
    s = _TAG.sub("", s)
    for _ in range(3):  # algumas fontes trazem entidades duplamente escapadas (&amp;gt;)
        u = html.unescape(s)
        if u == s:
            break
        s = u
    s = s.replace("\xa0", " ").replace("\x00", "")
    paras = []
    for block in re.split(r"\n\s*\n", s):
        lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in block.split("\n")]
        text = "\n".join(ln for ln in lines if ln)
        if text:
            paras.append(text)
    return "\n\n".join(paras)
