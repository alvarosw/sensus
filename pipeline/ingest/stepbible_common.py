"""Helpers compartilhados pelos ingestores STEPBible (TBESG, TBESH, TFLSJ, TIPNR).

Fonte: github.com/STEPBible/STEPBible-Data, CC BY 4.0 (Tyndale House / STEPBible.org).
Os arquivos são baixados em um commit fixo (SHA) para reprodutibilidade.
"""

import html
import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sensus.staging import StagingWriter, cite_lex  # noqa: E402
from sensus.strong import strong_base  # noqa: E402

REPO_SHA = "dd88ab3772971e17c0ec28a5a6e34f2e97c2f848"
RAW_BASE = f"https://raw.githubusercontent.com/STEPBible/STEPBible-Data/{REPO_SHA}"
REPO_URL = f"https://github.com/STEPBible/STEPBible-Data/tree/{REPO_SHA}"
VERSION = f"{REPO_SHA[:7]} (commit de 2026-10-09)"
LICENSE = "CC-BY-4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
ATTRIBUTION = (
    'Dados criados por STEP Bible (www.STEPBible.org), baseados em trabalho da '
    'Tyndale House Cambridge. Licença CC BY 4.0: credite "STEP Bible" com link para www.STEPBible.org.'
)


def download(repo_path: str, dest: Path) -> Path:
    """Baixa um arquivo do repositório no commit fixo. Idempotente: pula se já existe."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    url = f"{RAW_BASE}/{requests.utils.quote(repo_path)}"
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(r.content)
    tmp.replace(dest)
    return dest


def read_text(path: Path) -> list[str]:
    """Lê o arquivo como UTF-8 (removendo BOM) e devolve as linhas sem '\\r'."""
    text = path.read_text(encoding="utf-8-sig")
    return [ln.rstrip("\r") for ln in text.split("\n")]


_TAG_BREAK = re.compile(r"<\s*br\s*/?\s*>|<\s*/?\s*p\s*/?\s*>", re.I)
_TAG = re.compile(r"<(?:\"[^\"]*\"|'[^']*'|[^'\">])*>")  # tags com atributos entre aspas
_WS = re.compile(r"[ \t ]+")


def clean_html(s: str) -> str:
    """HTML do STEPBible -> texto puro. <BR> vira parágrafo ('\\n\\n'); tags são removidas."""
    if not s:
        return ""
    # Links de citação "[Refs ...]" do TFLSJ: descartados (são hover-text, não conteúdo).
    s = re.sub(r"\[?\s*<a\b(?:\"[^\"]*\"|'[^']*'|[^'\">])*>\s*Refs\b.*?</a>\s*\]?", "", s, flags=re.I | re.S)
    s = _TAG_BREAK.sub("\n\n", s)
    s = _TAG.sub("", s)
    s = html.unescape(s)
    s = re.sub(r"__+\s*(?=[\w(])", "", s)  # marcadores de sentido: "__2." -> "2.", "__(a)" -> "(a)"
    s = re.sub(r"\[Refs\b[^\n]*", "", s)  # citações de hover em texto puro (TBESG)
    s = s.replace(" ", " ")
    paras = []
    for p in re.split(r"\n\s*\n", s):
        p = _WS.sub(" ", p).strip()
        p = re.sub(r"\s*\n\s*", " ", p)
        if p:
            paras.append(p)
    return "\n\n".join(paras)


# 5 dígitos existem (ex.: G20001). Sufixos são mantidos como na fonte: maiúsculos (G2424G)
# e, em 7 chaves hebraicas, minúsculos (H2148v), para casar com as tags originais.
_STRONG = re.compile(r"^\s*([GH]\d{4,5}[A-Za-z]*)")


def dstrong_key(field: str) -> str | None:
    """Primeiro token de 'G2424G =' -> 'G2424G'. Retorna None se não for um Strong."""
    m = _STRONG.match(field)
    return m.group(1) if m else None


def read_lexicon_table(lines: list[str]) -> list[list[str]]:
    """Extrai as linhas de dados de um TBESG/TBESH/TFLSJ.

    Cabeçalho: linha cujos campos começam com 'eStrong' seguido de 'dStrong'.
    Dados: linhas com >= 8 campos cuja coluna 2 (dStrong) começa com G/H + 4 ou 5 dígitos.
    Colunas: 0 eStrong, 1 dStrong (+ texto de relação '=' ), 2 uStrong/equivalente,
             3 original, 4 translit., 5 morfologia, 6 gloss, 7 definição.
    """
    start = None
    for i, ln in enumerate(lines):
        f = ln.split("\t")
        if len(f) >= 2 and f[0].startswith("eStrong") and f[1].strip() == "dStrong":
            start = i + 1
            break
    if start is None:
        raise RuntimeError("cabeçalho eStrong/dStrong não encontrado")
    rows = []
    for ln in lines[start:]:
        if not ln.strip():
            continue
        f = ln.split("\t")
        if len(f) < 8 or dstrong_key(f[1]) is None:
            continue
        rows.append(f)
    return rows


def write_lexicon(w: StagingWriter, rows: list[list[str]], lang: str, seen: set | None = None) -> int:
    """Grava lexicon_entry a partir das linhas de read_lexicon_table. Chave = dStrong."""
    seen = set() if seen is None else seen
    n = dup = empty_def = 0
    for f in rows:
        key = dstrong_key(f[1])
        if key in seen:
            dup += 1
            continue
        seen.add(key)
        lemma = clean_html(f[3])
        translit = clean_html(f[4])
        gloss = clean_html(f[6])
        definition = clean_html(f[7])
        if not definition:
            empty_def += 1
            definition = gloss
        w.row(
            "lexicon_entry",
            cite_id=cite_lex(w.source_id, key),
            key=key,
            strong_base=strong_base(key),
            lemma=lemma or None,
            translit=translit or None,
            gloss=gloss or None,
            definition=definition,
            lang=lang,
        )
        n += 1
    print(f"  entradas={n} duplicadas_ignoradas={dup} definicao_vazia_usou_gloss={empty_def}")
    return n
