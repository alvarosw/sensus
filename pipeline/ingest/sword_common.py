"""Helpers compartilhados pelos ingestores de módulos SWORD (CrossWire).

- download idempotente do .zip do repositório rawzip para data/raw/<source_id>/
- extração segura do .zip e leitura do .conf (pysword.modules.SwordModules)
- leitura bruta dos versículos (pysword.bible: drivers zText/zCom e zText4/zCom4)
- remoção de marcação OSIS/ThML em texto puro

Notas:
- pysword 0.2.8 só expõe Bíblias (ZText). Módulos zCom/zCom4 usam o mesmo
  layout de índice (.bzs/.bzv/.bzz ou .czs/.czv/.czz), então são lidos pela
  classe ZText/ZText4 do pysword, chamando o método privado _text_for_index.
- O índice cobre também os slots de introdução (versículo 0), que são
  enumerados em iter_slots().
"""

import functools
import html
import re
import urllib.request
import zipfile
from pathlib import Path

from pysword.bible import SwordBible
from pysword.books import BibleStructure
from pysword.modules import SwordModules

from sensus.refs import BOOKS, vid as make_vid

BASE_URL = "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/"
ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
BOOK_CHAPTERS = {b[0]: b[5] for b in BOOKS}


# ---- download / extração ---------------------------------------------------

def download(zip_name: str, source_id: str) -> Path:
    """Baixa <zip_name> para data/raw/<source_id>/ (pula se já existe)."""
    dest_dir = RAW / source_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / zip_name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(BASE_URL + zip_name, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 16):
            f.write(chunk)
    tmp.rename(dest)
    return dest


def extract(zip_path: Path) -> Path:
    """Extrai o zip em <dir>/extracted/ (pula se já extraído). Retorna a raiz SWORD (contém mods.d/)."""
    out = zip_path.parent / "extracted"
    if (out / "mods.d").is_dir():
        return out
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            if name.startswith("/") or ".." in Path(name).parts:
                raise ValueError(f"caminho inseguro no zip: {name!r}")
        z.extractall(out)
    if (out / "mods.d").is_dir():
        return out
    found = list(out.rglob("mods.d"))
    if len(found) != 1:
        raise RuntimeError(f"mods.d não encontrado em {zip_path}")
    return found[0].parent


# ---- conf ------------------------------------------------------------------

def read_conf(root: Path, module: str) -> dict:
    """Metadados do módulo (chaves em minúsculas, como no .conf)."""
    conf = dict(SwordModules(str(root)).parse_modules()[module])
    conf["_root"] = str(root)
    conf["_name"] = module
    return conf


# Endereço de e-mail, com ou sem <> em volta (ex.: "Nome <pessoa@dominio.net>").
_EMAIL = re.compile(r"[ \t]*<?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>?")

# Contatos pessoais em front matter (About, introduções de livro/capítulo): telefone, endereço postal.
# Telefone: 3-3-4 ou 2-3-4 dígitos em grupos (opcionalmente com +DDI ou (DDD)).
_PHONE = re.compile(r"(?<![\d.])(?:\+\d{1,3}[ .-]?)?\(?\d{2,3}\)?[ .-]\d{3,4}[ .-]\d{4}(?!\d)")
# CEP/ZIP: código de 5 dígitos depois de sigla de estado ou vírgula (ou 12345-678 / 12345-6789).
_POSTAL_CODE = re.compile(r"(?:\b[A-Z]{2}\b,?\s+|,\s*)\d{5}(?:-\d{3,4})?(?!\d)|(?<!\d)\d{5}-\d{3}(?!\d)|\bCEP\b")
# Logradouro: número, 1 a 3 palavras com inicial maiúscula e um tipo de via por extenso (ou abreviado sem ambiguidade).
_STREET = re.compile(
    r"(?<![\w.])\d{1,6}[ ,]+(?:[A-Z][\w.'’-]*[ ,]+){1,3}"
    r"(?:Street|Road|Avenue|Boulevard|Drive|Lane|Court|Suite|Place|Apartment|Building|Highway|Rd|Ave|Blvd|Ste|Apt)(?!\w)"
)
# Caixa postal, rua e avenida (português).
_POBOX = re.compile(r"\b(?:P\.?\s*O\.?\s*Box\s*\d+|Caixa\s+Postal|Rua\s+[A-Z]|Avenida\s+[A-Z])")


def strip_emails(s: str) -> str:
    """Remove endereços de e-mail de terceiros (metadados e corpo dos módulos)."""
    return _EMAIL.sub("", s)


_SENTENCE_END = re.compile(r"(?<=[.!?;])\s+")
_SHORT_LINE = 240


def _is_contact(s: str) -> bool:
    return bool(_PHONE.search(s) or _STREET.search(s) or _POBOX.search(s) or _POSTAL_CODE.search(s))


def strip_contacts(s: str) -> str:
    """Remove contatos pessoais de texto de front matter; título, autoria e o restante ficam.

    - e-mail sai do trecho;
    - linha curta (até _SHORT_LINE) com telefone, logradouro, caixa postal ou CEP/ZIP sai inteira;
    - linha longa sai só nas frases que trazem o contato (o resto da prosa fica).
    Usado só em About/Description e em introduções (versículo 0), não no corpo dos verbetes.
    """
    kept = []
    for ln in strip_emails(s).split("\n"):
        if not _is_contact(ln):
            kept.append(ln)
        elif len(ln) > _SHORT_LINE:
            parts = [p for p in _SENTENCE_END.split(ln) if p and not _is_contact(p)]
            if parts:
                kept.append(" ".join(parts).strip())
    out = "\n".join(kept)
    out = re.sub(r"[ \t]+\n", "\n", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def conf_plain(s: str | None) -> str:
    """Texto de About/Description (com \\par) em texto simples, sem contatos pessoais."""
    if not s:
        return ""
    s = s.replace("\\\n", " ").replace("\\par", "\n")
    s = re.sub(r"\n\s*\n", "\n\n", s)
    return strip_contacts(re.sub(r"[ \t]+", " ", s)).strip()


# ---- leitura -----------------------------------------------------------------

_MODDRV = {"ztext": "ztext", "zcom": "ztext", "ztext4": "ztext4", "zcom4": "ztext4"}


def open_module(conf: dict) -> SwordBible:
    """Abre o módulo com o leitor ZText/ZText4 do pysword (também zCom/zCom4)."""
    drv = conf["moddrv"].lower()
    if drv not in _MODDRV:
        raise ValueError(f"driver não suportado: {conf['moddrv']}")
    path = str(Path(conf["_root"]) / conf["datapath"])
    reader = SwordBible(
        path,
        _MODDRV[drv],
        conf.get("versification", "kjv").lower(),
        conf["encoding"].lower() if conf.get("encoding") else None,
        conf.get("sourcetype") or "OSIS",
        conf.get("blocktype") or "BOOK",
        "ZIP",
        None,
    )
    # pysword descomprime o bloco inteiro a cada versículo; cache dos blocos recentes.
    reader._decompressed_text = functools.lru_cache(maxsize=32)(reader._decompressed_text)
    return reader


_CANON = None


def canon_books():
    """Livros do cânon KJV na ordem canônica: [(testament, book_num, BookStructure)]."""
    global _CANON
    if _CANON is None:
        books = BibleStructure("kjv").get_books()
        out, n = [], 0
        for testament in ("ot", "nt"):
            for b in books[testament]:
                n += 1
                out.append((testament, n, b))
        assert len(out) == 66
        for _, num, b in out:
            assert b.num_chapters == BOOK_CHAPTERS[num], (b.name, num)
        _CANON = out
    return _CANON


def iter_slots():
    """Gera (vid, testament, index) de todos os slots do módulo, na ordem SWORD.

    Cada livro ocupa: 1 slot de introdução do livro (vid livro,0,0), depois para
    cada capítulo: 1 slot de introdução (vid livro,c,0) e os versículos.
    Os dois primeiros slots de cada testamento são cabeçalhos (sem texto).
    """
    for testament in ("ot", "nt"):
        idx = 2
        for t, num, book in canon_books():
            if t != testament:
                continue
            yield make_vid(num, 0, 0), testament, idx
            idx += 1
            for ch, nverses in enumerate(book.chapter_lengths, start=1):
                yield make_vid(num, ch, 0), testament, idx
                idx += 1
                for v in range(1, nverses + 1):
                    yield make_vid(num, ch, v), testament, idx
                    idx += 1


def raw_entries(reader):
    """Gera (vid, texto_bruto) para todos os slots do módulo (vazios incluídos)."""
    have = getattr(reader, "_testaments", {})
    for v, testament, idx in iter_slots():
        if testament not in have:
            continue
        yield v, reader._text_for_index(testament, idx)


# ---- markup -> texto puro -----------------------------------------------------

_COMMENT = re.compile(r"<!--.*?-->", re.S)
_NOTE = re.compile(r"<note\b[^>]*>(.*?)</note\s*>", re.S | re.I)
_BLOCK = re.compile(
    r"</?(p|div|title|lg|l|item|head|table|tr|row|blockquote|list|h\d)\b[^>]*?/?>|<hr\b[^>]*?/?>", re.I)
_DOUBLE_BR = re.compile(r"(?:<br\b[^>]*?/?>\s*){2,}", re.I)
_BR = re.compile(r"<(br|lb)\b[^>]*?/?>", re.I)
_CELL = re.compile(r"</?cell\b[^>]*?/?>", re.I)
_TAG = re.compile(r"<[^>]*>")
_ESCAPED_TAG = re.compile(
    r"</?(?:ol|ul|li|span|font|center|small|big|tt|sup|sub|a|em|strong|b|i|u|p|div|br|hr|h\d|img|table|td|tr|th)\b[^<>]*>",
    re.I)
# Índices de navegação do CCEL (links scrBook) no Calvin: listas de referências sem prosa.
# Fragmentos cortados na fronteira de registro também são removidos.
_NAV = re.compile(r"<a\s[^>]*scrBook[^>]*>.*?</a\s*>", re.S | re.I)
_NAV_HEAD = re.compile(r'^[^<]*?href="\?scrBook[^"]*"[^>]*>[^<]*</a\s*>', re.S | re.I)
_NAV_TAIL = re.compile(r"<a(?:\s[^>]*)?$", re.S | re.I)


def _plain(s: str) -> str:
    s = _DOUBLE_BR.sub("\n\n", s)
    s = _BLOCK.sub("\n\n", s)
    s = _BR.sub(" ", s)
    s = _CELL.sub(" ", s)
    s = _TAG.sub("", s)
    s = html.unescape(s)
    # Marcação escapada na fonte (&lt;ol&gt; etc.) que só aparece após unescape.
    s = _ESCAPED_TAG.sub("", s)
    s = s.replace("&c;", "etc.")
    s = s.replace("\xa0", " ").replace("\r", "")
    s = re.sub(r"[ \t\f\v]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def strip_markup(raw: str, keep_notes: bool = True) -> str:
    """OSIS/ThML -> texto puro com '\\n\\n' entre parágrafos.

    Remove todas as tags (Strong, morfologia, milestones, marcadores de capítulo) e
    mantém o texto de <scripRef>, <reference>, <w>, <hi>, <foreign> etc.
    Notas de rodapé (<note>) saem do meio do texto e vão para o fim do verbete,
    cada uma como parágrafo "Nota: ..." (se keep_notes), para não quebrar a leitura.
    """
    if not raw:
        return ""
    s = _COMMENT.sub("", raw)
    s = _NAV_HEAD.sub("", s)
    s = _NAV.sub("", s)
    s = _NAV_TAIL.sub("", s)
    # Tags cortadas na fronteira do registro (o próprio módulo tem registros truncados).
    s = re.sub(r"<[^<>]*$", "", s)
    s = re.sub(r'^[^<>]*?=\"[^\"<>]*\"[^<>]*?>', "", s)
    notes: list[str] = []
    s = _NOTE.sub(lambda m: notes.append(m.group(1)) or "", s)
    parts = [_plain(s)]
    if keep_notes:
        parts += [f"Nota: {t}" for t in (_plain(n) for n in notes) if t]
    return "\n\n".join(p for p in parts if p)
