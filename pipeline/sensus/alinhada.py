"""Bíblias do staging na numeração da KJV, com os nomes próprios marcados (base dos nomes das línguas).

Mesma sequência de pipeline/package_bibles.check_versification (título de salmo como v.1, regras da TVTMS, versículos
fundidos), mas sem o limiar de contagem: aqui a Bíblia só precisa ser lida na numeração da KJV para extrair nomes,
não para ser empacotada. Os nomes \\pn (proper_names.jsonl, na numeração da própria Bíblia) saem na numeração da KJV
pelo mesmo mapeamento das divisões (res.target).

Bíblias do banco principal (BLivre) já estão na numeração da KJV: são lidas direto, sem TVTMS e sem nomes marcados.

Uso: a partir da raiz do repositório, com cd pipeline && python3 -m unittest discover tests (ver test_alinhada.py).
"""

import json
import sys
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "bibles"))

import tvtms as TV  # noqa: E402
from sensus.staging import STAGING  # noqa: E402


def _jsonl(path: Path, obrigatorio: bool = True) -> list[dict]:
    if not path.exists():
        if obrigatorio:
            raise FileNotFoundError(f"staging ausente: {path}")
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(linha) for linha in f if linha.strip()]


def versiculos_kjv(bible_id: str) -> tuple[dict[int, str], dict[int, list[str]]]:
    """Devolve (vid KJV -> texto, '' se numerado sem texto; vid KJV -> nomes marcados, na ordem do texto)."""
    base = STAGING / "bibles" / bible_id
    if not (base / "verse_text.jsonl").exists():
        base = STAGING / bible_id  # banco principal: já na numeração da KJV
        verses = {r["vid"]: r["text"] for r in _jsonl(base / "verse_text.jsonl")}
        return verses, {}

    verses = {r["vid"]: r["text"] for r in _jsonl(base / "verse_text.jsonl")}
    heads: dict[int, str] = {}
    for d in _jsonl(base / "text_division.jsonl", obrigatorio=False):
        if d["kind"] == "heading" and d.get("title"):
            heads[d["vid"]] = f"{heads[d['vid']]} {d['title']}" if d["vid"] in heads else d["title"]
    kjv = {r["vid"]: r["text"] for r in _jsonl(STAGING / "kjv" / "verse_text.jsonl")}
    index = TV.index_rules(TV.load_rules_file()[0])
    overrides, _ = TV.title_as_verse(verses, heads, kjv, index, frozenset(kjv))
    res = TV.reversify(verses, heads, index, frozenset(kjv), overrides)

    nomes: dict[int, list[str]] = {}
    for r in _jsonl(base / "proper_names.jsonl", obrigatorio=False):
        vi = res.target.get(r["vid"])
        if vi is not None and vi in res.numbered:
            nomes.setdefault(vi, []).extend(r["names"])
    return res.numbered, nomes
