"""Ingestor: geocodificação bíblica do OpenBible.info (CC BY 4.0) -> entity + entity_ref.

Fonte: github.com/openbibleinfo/Bible-Geocoding-Data (commit fixado abaixo),
arquivos data/ancient.jsonl (lugares bíblicos), data/modern.jsonl (localizações
modernas, com lonlat "lon,lat") e data/source.jsonl (fontes citadas).

Uma entidade (type='place') por lugar antigo (cite_id ent:openbible-geo:<id>).
Coordenadas = localização moderna de maior score em modern_associations.
Lugares sem associação moderna ficam com lat/lon NULL.

Uso:
    cd pipeline && .venv/bin/python -I ingest/openbible-geo.py
"""

import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests  # noqa: E402

from sensus.refs import book_num, vid  # noqa: E402
from sensus.staging import RAW, StagingWriter, cite_ent  # noqa: E402

SOURCE_ID = "openbible-geo"
COMMIT = "7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f"  # main em 2021-11-01
REPO_URL = "https://github.com/openbibleinfo/Bible-Geocoding-Data"
RAW_BASE = f"https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/{COMMIT}/data/"
RAW_DIR = RAW / SOURCE_ID
FILES = ["ancient.jsonl", "modern.jsonl", "source.jsonl"]


def download() -> None:
    d = RAW_DIR / "data"
    d.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        path = d / name
        if path.exists() and path.stat().st_size > 0:
            continue
        r = requests.get(RAW_BASE + name, timeout=300)
        r.raise_for_status()
        tmp = path.with_suffix(".part")
        tmp.write_bytes(r.content)
        tmp.replace(path)


def read_jsonl(name: str) -> list[dict]:
    with open(RAW_DIR / "data" / name, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


_TAG_RE = re.compile(r"</?(?:modern|ancient|source)\b[^>]*>|<[^>]+>")


def plain(text: str | None) -> str:
    """Remove as tags XML/HTML embutidas nas descrições ('<modern id=..>Nome</modern>' -> 'Nome')."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", html.unescape(_TAG_RE.sub("", text))).strip()


def parse_lonlat(s: str) -> tuple[float, float]:
    lon, lat = (float(x) for x in s.split(","))
    return lat, lon


def osis_to_vid(ref: str) -> int:
    book, ch, vs = ref.strip().split(".")
    return vid(book_num(book), int(ch), int(vs))


def verse_vids(anc: dict) -> set[int]:
    """Versículos onde o lugar aparece, na versificação KJV.

    'verses' traz OSIS no padrão ESV; quando 'alternate_verses' tem 'kjv', usa-se esse valor.
    57 registros não têm 'verses': cai para 'extra.osises' (sem remapeamento possível).
    """
    out: set[int] = set()
    if anc.get("verses"):
        for v in anc["verses"]:
            ref = v.get("alternate_verses", {}).get("kjv", v["osis"])
            out.add(osis_to_vid(ref))
    else:
        extra = json.loads(anc.get("extra") or "{}")
        for ref in extra.get("osises", []):
            out.add(osis_to_vid(ref))
    return out


def main() -> None:
    download()
    ancient = read_jsonl("ancient.jsonl")
    modern = {m["id"]: m for m in read_jsonl("modern.jsonl")}
    sources = {s["id"]: s for s in read_jsonl("source.jsonl")}

    def source_label(sid: str) -> dict:
        s = sources.get(sid, {})
        return {"source": s.get("friendly_id") or sid, "display_name": s.get("display_name"), "source_id": sid}

    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="entity",
            title="OpenBible.info Bible Geocoding Data",
            author="OpenBible.info",
            lang="en",
            license="CC-BY-4.0",
            license_url="https://creativecommons.org/licenses/by/4.0/",
            url=REPO_URL,
            version=f"commit {COMMIT[:7]} (main, 2021-11-01)",
            attribution=(
                "Bible geocoding data: OpenBible.info (https://www.openbible.info/geo/), "
                "licença Creative Commons Attribution 4.0 (CC BY 4.0)."
            ),
            notes=(
                "SHARE-ALIKE PARCIAL: o README informa que alguns dados de localização vêm do OpenStreetMap "
                "(ODbL 1.0, descrita pelo autor como semelhante a CC-BY-SA). Os pontos lat/lon aqui "
                "gravados podem derivar do OSM; verificar obrigações ODbL antes de redistribuir um banco derivado. "
                "Textos em inglês (fonte original); não traduzidos. Geometrias e miniaturas não foram "
                "ingeridas (licenças de imagem variam). Os campos em data guardam os metadados originais. "
                "Lugares sem localização moderna associada ficam com lat/lon NULL; "
                "resolvidos 'special' (ex.: not_a_proper_name) aparecem na data."
            ),
        )

        n_coords = n_refs = 0
        for anc in ancient:
            ident_list = anc.get("identifications", [])
            assoc = anc.get("modern_associations") or {}
            ranked = sorted(assoc.items(), key=lambda kv: (-kv[1].get("score", 0), kv[0]))

            best_mid = best_info = None
            for mid, info in ranked:
                m = modern.get(mid)
                if m and m.get("lonlat"):
                    best_mid, best_info = mid, info
                    break

            lat = lon = None
            best_m = modern.get(best_mid) if best_mid else None
            best_ident = None
            if best_m:
                lat, lon = parse_lonlat(best_m["lonlat"])
                n_coords += 1
                idx = best_info.get("identification_ids", [[None, None]])[0][0]
                if idx is not None and idx < len(ident_list):
                    best_ident = ident_list[idx]

            # Resumo das identificações (texto e votos vindos da própria fonte).
            idents = []
            for i in ident_list:
                score = i.get("score", {})
                tags = (i.get("votes") or {}).get("tags", {})
                idents.append({
                    "id_source": i.get("id_source"),
                    "id": i.get("id"),
                    "class": i.get("class"),
                    "description": plain(i.get("description")),
                    "types": i.get("types", []),
                    "modifier": i.get("modifier"),
                    "special": i.get("special"),
                    "votes": tags,
                    "vote_total": score.get("vote_total"),
                    "vote_count": score.get("vote_count"),
                    "time_total": score.get("time_total"),
                })

            # Descrição: só o que está nos dados.
            parts = []
            name = anc["friendly_id"]
            if best_m:
                mname = plain(best_m.get("friendly_id")) or best_mid
                parts.append(
                    f'Best modern identification: {mname} ({best_m.get("type", "?")}, '
                    f'{best_m.get("geometry", "?")} geometry); association score {best_info.get("score")}/1000.'
                )
                if best_ident is not None:
                    ident_text = plain(best_ident.get("description"))
                    parts.append(f'Identification: "{ident_text}" ({best_ident.get("id_source")}).')
                    tags = (best_ident.get("votes") or {}).get("tags", {})
                    if tags:
                        votes = ", ".join(f"{k} {v}" for k, v in sorted(tags.items()))
                        parts.append(f"Votes: {votes}.")
                    st = best_ident.get("score", {}).get("time_total")
                    if st is not None:
                        parts.append(f"Time-weighted score {st}/1000.")
                others = len(ranked) - 1
                if others > 0:
                    parts.append(f"{others} other candidate modern location(s) in the dataset.")
            else:
                specials = sorted({i.get("special") for i in ident_list if i.get("special")})
                parts.append("No modern location is associated with this place in the dataset.")
                if specials:
                    parts.append(f"Dataset special resolution: {', '.join(specials)}.")
                texts = [plain(i.get("description")) for i in ident_list if plain(i.get("description"))]
                if texts:
                    parts.append(f'Identification text: "{texts[0]}".')
            description = " ".join(parts)

            linked = {}
            for sid, val in (anc.get("linked_data") or {}).items():
                linked[source_label(sid)["source"]] = {**val, **{"source_id": sid}}

            thumb = (anc.get("media") or {}).get("thumbnail")
            data = {
                "openbible_id": anc["id"],
                "url": f"https://www.openbible.info/geo/ancient/{anc['id']}/{anc.get('url_slug', '')}",
                "types": anc.get("types", []),
                "preceding_article": anc.get("preceding_article", ""),
                "translation_spellings": anc.get("translation_name_counts", {}),
                "best_modern": None if not best_m else {
                    "id": best_mid,
                    "name": plain(best_m.get("friendly_id")),
                    "lonlat": best_m["lonlat"],
                    "geometry": best_m.get("geometry"),
                    "type": best_m.get("type"),
                    "class": best_m.get("class"),
                    "precision": best_m.get("precision"),
                    "association_score": best_info.get("score"),
                    "url": f"https://www.openbible.info/geo/modern/{best_mid}/{best_m.get('url_slug', '')}",
                },
                "modern_candidates": [
                    {"id": mid, "name": info.get("name"), "score": info.get("score"),
                     "url_slug": info.get("url_slug")}
                    for mid, info in ranked
                ],
                "identifications": idents,
                "linked_data": linked,
                "thumbnail": None if not thumb else {
                    "credit": thumb.get("credit"),
                    "credit_url": thumb.get("credit_url"),
                    "image_id": thumb.get("image_id"),
                    "description": plain(thumb.get("description")),
                },
            }

            w.row(
                "entity",
                cite_id=cite_ent(SOURCE_ID, anc["id"]),
                type="place",
                name=name,
                description=description,
                lat=lat,
                lon=lon,
                data=json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            )

            seen = set()
            for v in sorted(verse_vids(anc)):
                if v in seen:
                    continue
                seen.add(v)
                w.row("entity_ref", entity_cite_id=cite_ent(SOURCE_ID, anc["id"]), vid=v, token_pos=None)
                n_refs += 1

        print(f"lugares com coordenadas: {n_coords}/{len(ancient)}; referências de versículo: {n_refs}")


if __name__ == "__main__":
    main()
