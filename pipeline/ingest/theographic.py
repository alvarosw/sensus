"""Ingestor: Theographic Bible Metadata (CC BY-SA 4.0) -> entity + entity_ref.

Fonte: github.com/robertrouse/theographic-bible-metadata (commit fixado abaixo), tabelas
json/people.json, places.json, peopleGroups.json, events.json e verses.json.
Cada registro tem 'id' (record id estável, ex.: 'recsU2ZSdzBvDqzgI') e 'fields'.
Relações entre tabelas são por record id; os versículos são mapeados para vid
pelo osisRef (KJV) da tabela verses.

cite_id = ent:theographic:<record id>. Tipos: people->person, places->place,
peopleGroups->group, events->event.

Uso:
    cd pipeline && .venv/bin/python -I ingest/theographic.py
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

SOURCE_ID = "theographic"
COMMIT = "cfb1c485d4da6fb63a69cb3b7f5b0752792f46bc"  # branch master, 2026-04-21
REPO_URL = "https://github.com/robertrouse/theographic-bible-metadata"
RAW_BASE = f"https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/{COMMIT}/"
RAW_DIR = RAW / SOURCE_ID
FILES = ["json/people.json", "json/places.json", "json/peopleGroups.json",
         "json/events.json", "json/verses.json", "LICENSE"]

KIND = {"people": "person", "places": "place", "peopleGroups": "group", "events": "event"}
LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")  # [texto](/gen#Gen.1.1) -> texto


def download() -> None:
    for name in FILES:
        path = RAW_DIR / name
        if path.exists() and path.stat().st_size > 0:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(RAW_BASE + name, timeout=300)
        r.raise_for_status()
        tmp = path.with_suffix(".part")
        tmp.write_bytes(r.content)
        tmp.replace(path)


def load(name: str) -> list[dict]:
    return json.loads((RAW_DIR / "json" / f"{name}.json").read_text(encoding="utf-8"))


TAG_RE = re.compile(r"<[^>]+>")
EMPH_RE = re.compile(r"(?<![\w])_([^_\n]+?)_(?![\w])")  # _itálico_ em Markdown


def prose_one(s: str | None) -> str | None:
    if not s:
        return None
    s = LINK_RE.sub(r"\1", s)
    s = html.unescape(TAG_RE.sub("", s))
    s = EMPH_RE.sub(r"\1", s)
    s = s.replace("_", "")  # marcadores de ênfase órfãos do Markdown
    paras = [re.sub(r"[ \t]+", " ", p).strip() for p in s.split("\n")]
    text = "\n\n".join(p for p in paras if p)
    return text or None


def prose(v) -> str | None:
    """Texto puro de dictionaryText (str) ou dictText (lista de parágrafos Markdown)."""
    if isinstance(v, list):
        parts = [prose_one(x) for x in v]
        text = "\n\n".join(p for p in parts if p)
        return text or None
    return prose_one(v)


def num(s) -> float | None:
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def osis_vid(ref: str) -> int:
    book, ch, vs = ref.strip().split(".")
    return vid(book_num(book), int(ch), int(vs))


def main() -> None:
    download()
    tables = {name: load(name) for name in KIND}
    verse_recs = load("verses")
    verse_vid = {v["id"]: osis_vid(v["fields"]["osisRef"]) for v in verse_recs}

    def name_of(tname: str, f: dict) -> str:
        if tname == "people":
            return f.get("displayTitle") or f.get("name")
        if tname == "places":
            return f.get("displayTitle") or f.get("kjvName")
        if tname == "peopleGroups":
            return f.get("groupName")
        return f.get("title")

    index: dict[str, dict] = {}
    for tname, recs in tables.items():
        for r in recs:
            index[r["id"]] = {
                "cite_id": cite_ent(SOURCE_ID, r["id"]),
                "name": name_of(tname, r["fields"]),
                "type": KIND[tname],
            }

    def link(ids) -> list[dict]:
        out = []
        for t in ids or []:
            hit = index.get(t)
            out.append({"cite_id": hit["cite_id"], "name": hit["name"]} if hit else {"id": t})
        return out

    def person_data(rid: str, f: dict) -> dict:
        return {
            "record_id": rid,
            "personLookup": f.get("personLookup"),
            "personID": f.get("personID"),
            "name": f.get("name"),
            "displayTitle": f.get("displayTitle"),
            "surname": f.get("surname"),
            "alsoCalled": f.get("alsoCalled"),
            "gender": f.get("gender"),
            "isProperName": f.get("isProperName"),
            "birthYear": f.get("birthYear"),
            "deathYear": f.get("deathYear"),
            "minYear": f.get("minYear"),
            "maxYear": f.get("maxYear"),
            "family": {
                "father": link(f.get("father")),
                "mother": link(f.get("mother")),
                "partners": link(f.get("partners")),
                "children": link(f.get("children")),
                "siblings": link(f.get("siblings")),
                "halfSiblingsSameMother": link(f.get("halfSiblingsSameMother")),
                "halfSiblingsSameFather": link(f.get("halfSiblingsSameFather")),
            },
            "memberOf": link(f.get("memberOf")),
            "birthPlace": link(f.get("birthPlace")),
            "deathPlace": link(f.get("deathPlace")),
            "timeline": link(f.get("timeline")),
            "eventsText": f.get("events"),
            "verseCount": f.get("verseCount"),
            "slug": f.get("slug"),
            "dictionaryLink": f.get("dictionaryLink"),
        }

    def place_data(rid: str, f: dict) -> dict:
        return {
            "record_id": rid,
            "placeLookup": f.get("placeLookup"),
            "placeID": f.get("placeID"),
            "kjvName": f.get("kjvName"),
            "esvName": f.get("esvName"),
            "featureType": f.get("featureType"),
            "featureSubType": f.get("featureSubType"),
            "precision": f.get("precision"),
            "openBibleLat": f.get("openBibleLat"),
            "openBibleLong": f.get("openBibleLong"),
            "recogitoLat": f.get("recogitoLat"),
            "recogitoLon": f.get("recogitoLon"),
            "recogitoType": f.get("recogitoType"),
            "recogitoLabel": f.get("recogitoLabel"),
            "recogitoUri": f.get("recogitoUri"),
            "recogitoComments": f.get("recogitoComments"),
            "comment": f.get("comment"),
            "aliases": f.get("aliases"),
            "hasBeenHere": f.get("hasBeenHere"),
            "peopleBorn": link(f.get("peopleBorn")),
            "peopleDied": link(f.get("peopleDied")),
            "eventsHere": link(f.get("eventsHere")),
            "rootID": link(f.get("rootID")),
            "duplicate_of": link(f.get("duplicate_of")),
            "verseCount": f.get("verseCount"),
            "slug": f.get("slug"),
            "dictionaryLink": f.get("dictionaryLink"),
        }

    def event_data(rid: str, f: dict) -> dict:
        return {
            "record_id": rid,
            "eventID": f.get("eventID"),
            "title": f.get("title"),
            "startDate": f.get("startDate"),
            "duration": f.get("duration"),
            "lag": f.get("lag"),
            "lagType": f.get("lagType"),
            "rangeFlag": f.get("rangeFlag"),
            "sortKey": f.get("sortKey"),
            "verseSort": f.get("verseSort"),
            "predecessor": link(f.get("predecessor")),
            "partOf": link(f.get("partOf")),
            "participants": link(f.get("participants")),
            "locations": link(f.get("locations")),
            "groups": link(f.get("groups")),
            "verseCount": len(f.get("verses") or []),
        }

    def group_data(rid: str, f: dict) -> dict:
        return {
            "record_id": rid,
            "groupName": f.get("groupName"),
            "members": link(f.get("members")),
            "partOf": link(f.get("partOf")),
            "events_dev": link(f.get("events_dev")),
            "eventsText": f.get("events"),
        }

    builders = {"people": person_data, "places": place_data,
                "peopleGroups": group_data, "events": event_data}

    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="entity",
            title="Theographic Bible Metadata",
            author="Robert Rouse (viz.bible)",
            lang="en",
            license="CC-BY-SA-4.0",
            license_url="https://creativecommons.org/licenses/by-sa/4.0/",
            url=REPO_URL,
            version=f"commit {COMMIT[:7]} (master, 2026-04-21)",
            attribution=(
                "Theographic Bible Metadata, por Robert Rouse / viz.bible "
                f"({REPO_URL}), licença Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)."
            ),
            notes=(
                "SHARE-ALIKE (CC BY-SA 4.0): um banco derivado que inclua estas entidades ou descrições "
                "deve ser distribuído sob CC BY-SA 4.0 (ou compatível), com atribuição. Verificar antes de "
                "publicar sensus.db. Descrições: texto de dictionaryText/dictText (inclui Easton's Bible "
                "Dictionary, 1897, segundo a documentação da fonte), em inglês, sem tradução; links Markdown "
                "removidos. Eventos sem 'notes' ficam com description NULL (a fonte não tem prosa). "
                "Datas (birthYear, deathYear, startDate) usam numeração astronômica ISO (0 = 1 a.C.) e são "
                "gravadas como vêm. Coordenadas: latitude/longitude ('melhor disponível', com origem em OpenBible.info "
                "e Recogito), com fallback para openBible*; openBible*/recogito* também ficam em data. "
                "Versículos vêm do campo verses (osisRef KJV, sem remapeamento). Não ingeridas: "
                "eastons, chaptersWritten, booksWritten, WordIndex, geo/ e Easton como tabela própria."
            ),
        )

        counts = {}
        bad_refs = 0
        for tname, recs in tables.items():
            for r in recs:
                rid = r["id"]
                f = r["fields"]
                ent_type = KIND[tname]
                if tname == "places":
                    lat = num(f.get("latitude"))
                    lon = num(f.get("longitude"))
                    if lat is None or lon is None:
                        lat = num(f.get("openBibleLat"))
                        lon = num(f.get("openBibleLong"))
                else:
                    lat = lon = None

                if tname == "events":
                    description = prose_one(f.get("notes"))
                elif tname == "peopleGroups":
                    description = None
                else:
                    description = prose(f.get("dictionaryText")) or prose(f.get("dictText"))

                w.row(
                    "entity",
                    cite_id=cite_ent(SOURCE_ID, rid),
                    type=ent_type,
                    name=index[rid]["name"],
                    description=description,
                    lat=lat,
                    lon=lon,
                    data=json.dumps(builders[tname](rid, f), ensure_ascii=False, separators=(",", ":")),
                )
                counts[ent_type] = counts.get(ent_type, 0) + 1

                seen = set()
                for vrec in f.get("verses") or []:
                    v = verse_vid.get(vrec)
                    if v is None:
                        bad_refs += 1
                        continue
                    if v in seen:
                        continue
                    seen.add(v)
                    w.row("entity_ref", entity_cite_id=cite_ent(SOURCE_ID, rid), vid=v, token_pos=None)

        print("entidades por tipo: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
        print(f"referências de verso sem correspondência: {bad_refs}")


if __name__ == "__main__":
    main()
