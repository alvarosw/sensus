"""Ingestor: stepbible-tipnr (TIPNR - Translators Individualised Proper Names with all References).

Fonte: STEPBible-Data (CC BY 4.0). Uso: cd pipeline && .venv/bin/python -I ingest/stepbible_tipnr.py

Formato (arquivo de registros, separados por linhas '$'):
  linha 1 do registro: UnifiedName=uStrong + campos (layout depende da seção: PERSON/OTHER/PLACE)
  sub-registros:       '– <significado>' + UniqueName, dStrong«eStrong=original, nome traduzido, refs
  '– Total':           nomes, dStrongs, refs abreviadas, contagem
  '@Briefest= / @Brief= / @Short= / @Article=': descrições (texto gerado por IA, segundo a TIPNR)
Seções ignoradas: EXCLUDED (marcadas como excluídas pela própria fonte).
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sensus import refs  # noqa: E402
from sensus.staging import RAW, StagingWriter, cite_ent, slug  # noqa: E402
import stepbible_common as sb  # noqa: E402

SOURCE_ID = "stepbible-tipnr"
REPO_PATH = ("Proper Nouns/TIPNR - Translators Individualised Proper Names with all References"
             " - STEPBible.org CC BY.txt")

TYPE_MAP = {"Male": "person", "Female": "person", "Place": "place", "Group": "group"}
SUB_PREFIX = "– "
AT_PREFIXES = ("@Briefest=", "@Brief=", "@Short=", "@Article=")
_REF = re.compile(
    r"^(?:LXX\.)?(?P<book>[1-3]?[A-Za-z]+)\.(?P<ch>\d+)\.(?P<v>\d+)[a-z]*"
    r"(?:-(?P<v2>\d+)[a-z]*|-(?P<c2>\d+)\.(?P<v3>\d+)[a-z]*)?$"
)
_COORD = re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)")
_STRONG_FORM = re.compile(r"^\s*([HG]\d{4,5}[A-Za-z]*)(?:«([HG]\d{4,5}[A-Za-z]*))?(?:=(.*))?$")


def clean_or_none(s: str | None) -> str | None:
    if s is None:
        return None
    s = s.strip()
    if s in ("", ">", "+", "+ "):
        return None
    return sb.clean_html(s) or None


def split_names(s: str) -> list[str]:
    """'Amram@Exo.6.18-1Ch + Jochebed@Exo.6.20-Num' / 'A@x, B@y' -> ['Amram@...', 'Jochebed@...']."""
    out = []
    for part in re.split(r"\s*\+\s*|\s*,\s*", s or ""):
        part = part.strip().rstrip("+").strip()
        if part and part != ">":
            out.append(part)
    return out


def _expand(book: int, ch: int, v: int, v2, c2, v3, stats: dict, vids: set):
    if c2:  # intervalo entre capítulos (não ocorre na fonte atual; tratado por segurança)
        for c in range(ch, c2 + 1):
            if not (1 <= c <= refs.BOOK_BY_NUM[book][5]):
                stats["ref_capitulo_invalido"] = stats.get("ref_capitulo_invalido", 0) + 1
                continue
            lo = v if c == ch else 1
            hi = v3 if c == c2 else 200
            for vv in range(lo, hi + 1):
                vids.add(refs.vid(book, c, vv))
    elif v2:
        for vv in range(v, v2 + 1):
            vids.add(refs.vid(book, ch, vv))
    else:
        vids.add(refs.vid(book, ch, v))


def parse_refs(text: str, stats: dict) -> set[int]:
    """'Exo.4.14; Exo.4.27; Exo.7.10a; Num.13.8,16' -> conjunto de vids (versificação KJV).

    Aceita: 'Livro.C.V', 'Livro.C.V-V2', 'Livro.C.V-C2.V3', 'LXX.Livro.C.V' e, após vírgula,
    apenas números (V, ou C.V no mesmo livro). Apócrifos e tokens não reconhecidos são contados.
    """
    vids: set[int] = set()
    for chunk in re.split(r";", text or ""):
        prev = None  # (book_num, chapter) do último token completo
        for part in chunk.split(","):
            tok = part.strip().rstrip(".").strip()
            if not tok or tok.lower() == "etc":
                if tok:
                    stats["ref_nao_reconhecida"] = stats.get("ref_nao_reconhecida", 0) + 1
                continue
            m = _REF.match(tok)
            if m:
                try:
                    book = refs.book_num(m.group("book"))
                except KeyError:
                    stats["ref_fora_canon"] = stats.get("ref_fora_canon", 0) + 1
                    stats.setdefault("livros_fora_canon", set()).add(m.group("book"))
                    prev = None
                    continue
                ch, v = int(m.group("ch")), int(m.group("v"))
                v2 = int(m.group("v2")) if m.group("v2") else None
                c2 = int(m.group("c2")) if m.group("c2") else None
                v3 = int(m.group("v3")) if m.group("v3") else None
            elif prev and re.fullmatch(r"\d+[a-z]*", tok):  # ', 16' -> verso no mesmo capítulo
                book, ch = prev
                v, v2, c2, v3 = int(re.match(r"\d+", tok).group(0)), None, None, None
            elif prev and re.fullmatch(r"\d+\.\d+[a-z]*", tok):  # ', 5.1' -> capítulo.verso no mesmo livro
                book = prev[0]
                ch, v = (int(x) for x in re.match(r"(\d+)\.(\d+)", tok).groups())
                v2 = c2 = v3 = None
            else:
                stats["ref_nao_reconhecida"] = stats.get("ref_nao_reconhecida", 0) + 1
                stats.setdefault("exemplos_nao_reconhecidas", set()).add(tok)
                prev = None
                continue
            if v == 0:  # superscrição dos Salmos (Psa.N.0): no texto inglês fica no versículo 1
                v = 1
                stats["superscricao_v0_para_v1"] = stats.get("superscricao_v0_para_v1", 0) + 1
            if not (1 <= ch <= refs.BOOK_BY_NUM[book][5]):
                stats["ref_capitulo_invalido"] = stats.get("ref_capitulo_invalido", 0) + 1
                prev = None
                continue
            _expand(book, ch, v, v2, c2, v3, stats, vids)
            prev = (book, ch)
    return vids


def parse_records(lines: list[str]):
    """Gera (secao, linhas_do_registro) para cada registro '$...' que não seja modelo/excluído."""
    cur = None
    recs = []
    for ln in lines:
        if ln.startswith("$"):
            cur = (ln, [])
            recs.append(cur)
        elif cur is not None:
            cur[1].append(ln)
    for sec_line, body in recs:
        if not body or not body[0].strip():
            continue
        head = body[0].split("\t")
        if "@" not in head[0] or "=" not in head[0] or "uStrong" in head[0]:
            continue  # modelo/documentação
        secao = re.sub(r"[=$]+", " ", sec_line).replace("\t", " ").strip()
        if "EXCLUDED" in secao:
            yield "EXCLUDED", secao, body
            continue
        yield secao, secao, body


def build(lines: list[str], w: StagingWriter):
    stats = {"registros": 0, "excluidos": 0, "ref_nao_reconhecida": 0, "ref_fora_canon": 0,
             "sem_article": 0, "sem_coord": 0, "com_coord": 0}
    entities = []  # dicts intermediários
    seen_ids = set()
    for secao, _, body in parse_records(lines):
        if secao == "EXCLUDED":
            stats["excluidos"] += 1
            continue
        head = body[0].split("\t")
        ident_full = head[0].split("=")[0].strip()
        ustrong = head[0].split("=", 1)[1].strip() if "=" in head[0] else None
        ident = ident_full
        tipo_raw = head[8].strip() if len(head) > 8 else ""
        is_place = secao.startswith("PLACE")
        etype = TYPE_MAP.get(tipo_raw, "other")
        name = ident.split("@")[0].split("|")[-1].strip()
        summary = next((c for c in head if c.startswith("#")), "")
        summary = sb.clean_html(summary.lstrip("#").strip())

        forms, total = [], None
        at = {}
        cont = []
        for ln in body[1:]:
            if ln.startswith(SUB_PREFIX):
                cols = ln.split("\t")
                sig = cols[0][len(SUB_PREFIX):].strip()
                if sig == "Total":
                    total = cols
                elif len(cols) >= 5 and cols[1].strip():
                    m = _STRONG_FORM.match(cols[2])
                    forms.append({
                        "significance": sig,
                        "name": cols[1].strip(),
                        "dstrong": m.group(1) if m else (cols[2].split("«")[0].strip() or None),
                        "estrong": (m.group(2) if m else None),
                        "original": (m.group(3).strip() if m and m.group(3) else None),
                        "translated": re.sub(r"\s*<[HG]\d+[A-Za-z]*>\s*", " ", cols[3]).strip() or None,
                        "_refs": cols[4],
                    })
            elif ln.lstrip().startswith("@") and "=" in ln:
                k, _, v = ln.lstrip().partition("=")
                at[k.lstrip("@").strip()] = v.strip()
            elif ln.strip() and not ln.startswith(("‖", "$")) and at:
                cont.append(ln.strip())  # linha solta após os campos @: registrada para conferência
        if cont:
            stats["linhas_soltas"] = stats.get("linhas_soltas", 0) + len(cont)
            stats.setdefault("exemplo_linha_solta", cont[0][:120])

        # Referências: união das sub-linhas (listagens exaustivas). Total serve só de conferência.
        vids = set()
        for fm in forms:
            vids |= parse_refs(fm["_refs"], stats)
        for fm in forms:
            fm.pop("_refs")

        # Relações / campos por tipo de layout
        data = {"tipnr_id": ident_full, "section": secao, "tipnr_type": tipo_raw, "ustrong": ustrong}
        lat = lon = None
        if is_place:
            data["openbible_name"] = clean_or_none(head[1])
            data["founders"] = split_names(head[2]) if len(head) > 2 else []
            data["residents"] = split_names(head[3]) if len(head) > 3 else []
            gmap = head[4] if len(head) > 4 else ""
            data["map_url"] = gmap.strip() or None
            data["geo_area"] = clean_or_none(head[6]) if len(head) > 6 else None
            m = _COORD.search(gmap) or _COORD.search(head[5] if len(head) > 5 else "")
            if m:
                lat, lon = float(m.group(1)), float(m.group(2))
                if (lat, lon) == (0.0, 0.0) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    lat = lon = None
        else:
            data["category"] = clean_or_none(head[1]) if len(head) > 1 else None
            data["parents"] = split_names(head[2]) if len(head) > 2 else []
            data["siblings"] = split_names(head[3]) if len(head) > 3 else []
            data["partners"] = split_names(head[4]) if len(head) > 4 else []
            data["offspring"] = split_names(head[5]) if len(head) > 5 else []
            data["tribe_nation"] = clean_or_none(head[6]) if len(head) > 6 else None
        data["forms"] = forms
        if total:
            data["strongs"] = [s.strip() for s in (total[2] if len(total) > 2 else "").split(",") if s.strip()]
            data["all_names"] = total[1].strip() if len(total) > 1 else None
            data["tipnr_total_count"] = int(total[4]) if len(total) > 4 and total[4].strip().isdigit() else None
        data["summary"] = summary or None
        # @Briefest/@Brief/@Short/@Article são texto gerado por IA (segundo a própria TIPNR):
        # política do Sensus é não armazenar conteúdo gerado por IA, então são descartados.
        if "Ambiguity" in at and at["Ambiguity"]:
            data["ambiguity"] = at["Ambiguity"]
        description = summary or None
        if lat is None:
            stats["sem_coord"] += 1
        else:
            stats["com_coord"] += 1

        cid_ident = slug(ident_full)
        if cid_ident in seen_ids:
            raise RuntimeError(f"id TIPNR duplicado após slug: {ident_full!r}")
        seen_ids.add(cid_ident)
        stats["registros"] += 1
        entities.append({"ident": cid_ident, "type": etype, "name": name, "description": description,
                         "lat": lat, "lon": lon, "data": data, "vids": vids,
                         "total": total})

    # Resolução das relações (parents/siblings/...) para cite_ids conhecidos
    known = {e["ident"] for e in entities}
    unresolved = 0
    for e in entities:
        d = e["data"]
        for k in ("parents", "siblings", "partners", "offspring", "founders", "residents"):
            if k in d:
                out = []
                for nm in d[k]:
                    bare = re.sub(r"\((?:[adf]\??|\?)\)", "", nm.split("|")[-1].split("=")[0])  # (d) (a) (f) (?)
                    target = slug(bare)
                    ok = target in known
                    unresolved += 0 if ok else 1
                    out.append({"name": nm, "cite_id": cite_ent(SOURCE_ID, target) if ok else None})
                d[k] = out

    for e in entities:
        cid = cite_ent(SOURCE_ID, e["ident"])
        w.row(
            "entity",
            cite_id=cid,
            type=e["type"],
            name=e["name"],
            description=e["description"],
            lat=e["lat"],
            lon=e["lon"],
            data=json.dumps(e["data"], ensure_ascii=False),
        )
        for vid in sorted(e["vids"]):
            w.row("entity_ref", entity_cite_id=cid, vid=vid, token_pos=None)

    stats["relacoes_sem_entidade"] = unresolved
    stats["entity_ref_linhas"] = sum(len(e["vids"]) for e in entities)
    stats["por_tipo"] = {t: sum(1 for e in entities if e["type"] == t) for t in sorted({e["type"] for e in entities})}
    return stats


def main():
    path = sb.download(REPO_PATH, RAW / SOURCE_ID / "TIPNR.txt")
    lines = sb.read_text(path)
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="entity",
            title="TIPNR - Translators Individualised Proper Names with all References",
            author="STEP Bible (www.STEPBible.org) / Tyndale House Cambridge",
            lang="en",
            license=sb.LICENSE,
            license_url=sb.LICENSE_URL,
            url=sb.REPO_URL,
            version=sb.VERSION,
            attribution=sb.ATTRIBUTION,
            notes=("Nomes próprios individualizados (pessoas, lugares, grupos e outros). "
                   "cite_id = ent:stepbible-tipnr:<nome@ref único da TIPNR, slugificado>. "
                   "description = resumo do cabeçalho do registro. Os campos @Brief/@Short/@Article "
                   "da TIPNR (gerados por IA) foram descartados por política do Sensus. Coordenadas: OpenBible (via links de mapa). "
                   "Entradas marcadas EXCLUDED pela fonte foram omitidas. "
                   "Versículos: versificação padrão inglesa (KJV); apócrifos não entram em entity_ref."),
        )
        stats = build(lines, w)
    for k, v in stats.items():
        if isinstance(v, set):
            v = sorted(v)[:15]
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
