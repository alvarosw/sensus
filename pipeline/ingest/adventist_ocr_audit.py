"""Gera a auditoria de correções de OCR das obras adventistas: ingest/corrections/<fonte>.tsv.

Cada linha do TSV é uma correção de uma palavra (ou a descarte de um parágrafo), com a regra usada:
  a  alinhado com outra digitalização de domínio público da mesma obra (mesmas 2 palavras antes e
     depois, e uma única palavra no meio, conhecida no inglês)
  b  uma única correção de confusão típica de OCR (fh->th, tbe->the, wbich->which, aud->and) que
     dá uma palavra do dicionário inglês e nenhuma outra
  c  capitular perdida: uma única letra à frente que dá palavra do dicionário
  drop  parágrafo com lixo de OCR que não se restaurou: sai do banco (nada é adivinhado)

O ingestor (adventist_pd.py) só APLICA o TSV, por chave = hash do parágrafo antes da correção.
Os números de página entre parênteses e as quebras de página são tratados no ingestor (regras d).

Uso (gera de novo; precisa do dicionário /usr/share/dict/american-english e dos scans):
    cd pipeline && .venv/bin/python -I ingest/adventist_ocr_audit.py smith-daniel,egw-thoughts
"""

import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest import adventist_pd as A  # noqa: E402

DICT_PATH = Path("/usr/share/dict/american-english")

# Outras digitalizações de domínio público da mesma obra (mesma edição ou edição anterior a 1929).
ALT = {
    "smith-daniel": [
        ("danielrevelation00smit_3", "https://archive.org/download/danielrevelation00smit_3/danielrevelation00smit_3_djvu.txt",
         "danielrevelation00smit_3_djvu.txt"),
        ("danielrevelation00smit_0", "https://archive.org/download/danielrevelation00smit_0/danielrevelation00smit_0_djvu.txt",
         "danielrevelation00smit_0_djvu.txt"),
    ],
    "egw-thoughts": [
        ("thoughtsfrommoun0000egwh", "https://archive.org/download/thoughtsfrommoun0000egwh/thoughtsfrommoun0000egwh_djvu.txt",
         "thoughtsfrommoun0000egwh_djvu.txt"),
    ],
}

# Confusões típicas de OCR (trocas de uma sequência por outra).
CONF = [("fh", "th"), ("rn", "m"), ("m", "rn"), ("cl", "d"), ("d", "cl"), ("b", "h"), ("h", "b"),
        ("u", "n"), ("n", "u"), ("li", "h"), ("ii", "u"), ("l", "i"), ("i", "l"), ("1", "l"),
        ("0", "o"), ("vv", "w"), ("w", "vv"), ("tl", "th"), ("c", "e"), ("e", "c"), ("w", "u"), ("1", "i"),
        ("ow", "ou"), ("ui", "ni")]
ORDINAL = re.compile(r"^\d+(st|nd|rd|th)[.,;:]?$")
JUNK_RAW = re.compile(r"[|~^<>\\{}]|[A-Za-z]\d|\d[A-Za-z]")


def junk(tok: str) -> bool:
    """Sinal de OCR ruim: símbolo de linha, letra colada a dígito (exceto 13th, 1st)."""
    return bool(JUNK_RAW.search(tok)) and not ORDINAL.match(tok)

EDGE = re.compile(r"^[^A-Za-z0-9]+|[^A-Za-z0-9]+$")


def load_dict() -> set[str]:
    return {w.lower() for w in DICT_PATH.read_text(encoding="utf-8").split() if w.isalpha()}


PREFIXES = ("un", "non", "re", "in", "im", "dis", "mis", "fore", "over", "under", "out", "up", "with", "be",
            "after", "un", "self", "God")
SUFFIXES = ("eth", "est", "ed", "d", "ing", "ly", "ness", "ful", "less", "ship", "hood", "able", "ment",
            "er", "ers", "th", "ths", "ance", "ence", "ion", "ions", "ism", "ity", "ous", "ive", "s", "es")


def morph_ok(n: str, words: set[str]) -> bool:
    """Forma arcaica ou derivada de palavra do dicionário: 'waiteth', 'unlovely', 'whole-hearted'."""
    def base_ok(b: str) -> bool:
        return len(b) >= 2 and (b in words or b + "e" in words or (len(b) > 3 and b[:-1] in words))
    if any(n.startswith(p) and base_ok(n[len(p):]) for p in PREFIXES if len(n) > len(p) + 2):
        return True
    return any(n.endswith(x) and base_ok(n[:-len(x)]) for x in SUFFIXES if len(n) > len(x) + 2)


def lev(a: str, b: str) -> int:
    """Distância de edição (Levenshtein)."""
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def garbage(tok: str, known) -> bool:
    """Lixo de OCR que não se corrige: sinal de linha, letra colada a dígito, sílaba sem vogal,
    ou letra solta (exceto a, i, o e o possessivo 's). Palavra desconhecida mas pronunciável fica."""
    if junk(tok):
        return True
    for part in tok_parts(tok):
        if part.isdigit() or known(part):
            continue
        abbrev = re.fullmatch(r"[A-Za-z][.,;:]", tok.strip("“”‘’\"'()[]")) is not None  # p., c., e.,
        if len(part) == 1 and part not in "aio" and not abbrev and not re.match(r"^[’']s\b", tok):
            return True
        if len(part) >= 2 and not re.search(r"[aeiouy]", part):
            return True
    return False


def norm(w: str) -> str:
    """Forma comparável: minúscula, sem pontuação, sem acento (é -> e)."""
    folded = unicodedata.normalize("NFKD", w.lower())
    return re.sub(r"[^a-z0-9]", "", folded.encode("ascii", "ignore").decode())


def tok_parts(tok: str) -> list[str]:
    """Partes normalizadas de uma palavra (hífen separa partes: 'well-springs')."""
    return [p for p in (norm(x) for x in re.split(r"[-—–]", tok)) if p]


def alt_tokens(text: str) -> list[tuple[str, str]]:
    out = []
    for w in text.split():
        n = norm(w)
        if n:
            out.append((n, EDGE.sub("", w)))
    return out


DETS = {"the", "this", "that", "these", "those", "a", "an", "his", "her", "our", "their", "its", "my",
        "your", "some", "no", "every", "any", "each", "another"}
CITE = re.compile(r"^(?:Dan|Rev|Isa|Eze|Ezek|Matt|Mark|Luke|John|Gen|Ex|Ps|Jer|Zech|Joel|Hos|Lev|Num|Deut|Acts)\.?,?$")


def footnote_spans(toks: list[str]) -> list[tuple[int, int]]:
    """Notas de rodapé intercaladas no texto do scan (índices de palavras, inclusive).

    - "[For portraits, see page 150.]" (legenda de retrato entre colchetes);
    - "Dan. 7:25, For biographical sketches, see Appendix." (nota de rodapé de página).
    """
    spans = []
    i = 0
    while i < len(toks):
        w = toks[i].strip(",;:.").lower()
        window = [x.strip(",;:.").lower() for x in toks[i:i + 7]]
        if toks[i].startswith("[For") and any(x.endswith("]") for x in toks[i:i + 9]):
            j = next(k for k in range(i, min(i + 9, len(toks))) if toks[k].endswith("]"))
            spans.append((i, j))
            i = j + 1
            continue
        if w in ("for", "see") and "appendix" in window[:6] and "biographical" in window[:3] or (
                w == "see" and window[:2] == ["see", "appendix"]):
            k = next(k for k in range(i, min(i + 7, len(toks))) if toks[k].strip(",;:.").lower() == "appendix")
            a = i
            if i >= 2 and CITE.match(toks[i - 2]) and toks[i - 1][:1].isdigit():
                a = i - 2
            elif i >= 1 and CITE.match(toks[i - 1]):
                a = i - 1
            spans.append((a, k))
            i = k + 1
            continue
        i += 1
    return spans


def main():
    names = sys.argv[1].split(",") if len(sys.argv) > 1 else list(ALT)
    words = load_dict()
    for sid in names:
        work = next(w for w in A.WORKS if w.source_id == sid)
        stats = Counter()
        raw_path = A.RAW / sid / work.raw_name
        body, _ = A.read_body(work, raw_path)
        paras = []  # (capítulo, marcas, texto, é_início_de_seção)
        starts_next = False
        prev_chapter = object()
        for c, m, p, epi in A.prepared(work, body, "", stats):
            starts_next = starts_next or epi is not None
            if not p:
                continue
            # início de seção: depois de uma epígrafe (Mt 5–7) ou de um novo capítulo do livro
            paras.append((c, m, p, starts_next or c != prev_chapter))
            prev_chapter = c
            starts_next = False
        # Texto de referência: as outras digitalizações (a obra inteira) e o próprio texto.
        alt: list[tuple[str, str]] = []
        for asid, url, name in ALT[sid]:
            path = A.fetch(url, A.RAW / sid / name)
            alt += alt_tokens(path.read_text(encoding="utf-8", errors="replace"))
        alt_counts = Counter(n for n, _ in alt)
        # Nomes próprios: forma com maiúscula inicial no outro scan (Jerusalem, Jehoiakim's).
        alt_proper = {n for n, raw in alt if raw[:1].isupper() and not raw.isupper()}
        ours_counts = Counter(norm(t) for _, _, para, _ in paras for t in para.split(" ") if norm(t))
        idx4: dict[tuple, Counter] = defaultdict(Counter)
        idxR: dict[tuple, Counter] = defaultdict(Counter)
        idxL: dict[tuple, Counter] = defaultdict(Counter)
        for j in range(2, len(alt) - 2):
            idx4[(alt[j - 2][0], alt[j - 1][0], alt[j + 1][0], alt[j + 2][0])][alt[j]] += 1
            idxR[(alt[j + 1][0], alt[j + 2][0])][alt[j]] += 1
            idxL[(alt[j - 2][0], alt[j - 1][0])][alt[j]] += 1

        def known(n: str) -> bool:
            """Palavra conhecida: no dicionário, derivação dele, número, ou repetida nos scans
            (OCR errado raramente se repete igual em duas digitalizações)."""
            if len(n) == 1:
                return n in "ai"
            return (n in words or (n.endswith("s") and n[:-1] in words) or n.isdigit()
                    or morph_ok(n, words) or alt_counts[n] >= 2 or ours_counts[n] >= 3
                    or (n in alt_proper))

        def bad(tok: str) -> bool:
            if junk(tok):
                return True
            # Maiúscula inicial (nome próprio) basta estar no outro scan; minúscula precisa de dicionário.
            return any(not p.isdigit() and not known(p) and not (tok[:1].isupper() and len(p) >= 3 and alt_counts[p] >= 1)
                       for p in tok_parts(tok))

        def cand_alt(c: Counter):
            """(forma normalizada, forma com caixa) se todas as ocorrências no outro scan são a mesma palavra."""
            cands = {n for (n, _) in c}
            if len(cands) != 1:
                return None
            n = next(iter(cands))
            raw = max((x for x in c if x[0] == n), key=lambda x: c[x])[1]
            return n, raw

        bigrams = {(alt[j][0], alt[j + 1][0]) for j in range(len(alt) - 1)}
        # Pares de palavras vistos nos outros scans e no próprio texto (para validar frases).
        ours_seq = [norm(t) for _, _, p, _ in paras for t in p.split(" ") if norm(t)]
        bi_counts = Counter(zip([x[0] for x in alt], [x[0] for x in alt][1:]))
        our_bi = Counter(zip(ours_seq, ours_seq[1:]))  # o texto desta obra, sem o outro scan (que repete o erro)
        bi_counts.update(our_bi)

        def ok_alt(n: str, cand: str) -> bool:
            """Candidata da outra digitalização: palavra do dicionário, a até 1-3 letras da ilegível."""
            maxd = 1 if len(n) <= 3 else 2 if len(n) <= 8 else 3
            return (cand != n and lev(n, cand) <= maxd and (cand in words or morph_ok(cand, words))
                    and not junk(cand))

        rows_out = []
        prev_dropped = False
        for chapter, _marks, para, is_start in paras:
            toks = para.split(" ")
            ns = [norm(t) for t in toks]
            edits = []
            unresolved: list[str] = []
            skip: set[int] = set()
            local = Counter(zip(ns, ns[1:]))  # pares desta própria frase não contam como confirmação
            # (e) notas de rodapé intercaladas no texto: saem; palavra partida pela nota é reunida
            for a, b in footnote_spans(toks):
                for k in range(a, b + 1):
                    edits.append((k, toks[k], "", "e"))
                    skip.add(k)
                stats["notas de rodapé intercaladas (e)"] += 1
                nxt = b + 1
                if nxt < len(toks) and toks[nxt][:1].islower() and a >= 1:
                    prev = toks[a - 1]
                    if prev.endswith("-"):
                        edits.append((a - 1, prev, prev[:-1] + toks[nxt], "e"))
                        edits.append((nxt, toks[nxt], "", "e"))
                        skip.add(nxt)
                    elif prev[-1:] in ".?!\"”’":
                        # continuação de frase que começa depois da nota: a parte perdida não se recupera
                        unresolved.append(f"continuação após nota: {toks[nxt]}")
                skip.update(range(a, b + 1))
            if is_start:
                stats["inícios de seção"] += 1
            for i, tok in enumerate(toks):
                n = ns[i]
                if not n or i in skip:
                    continue
                if re.fullmatch(r"\(\d{1,4}\)[.,;:]?", tok):
                    # (d) número de página entre parênteses: sai se o outro scan tem palavra (não número) no lugar
                    if i >= 1 and i + 1 < len(toks):
                        left = ns[i - 1] if i >= 1 else ""
                        right = ns[i + 1]
                        c = idxR.get((ns[i + 1], ns[i + 2])) if i + 2 < len(toks) else None
                        cands = {k for (k, _) in idx4.get((ns[i - 2], left, right, ns[i + 2]), ())} if i >= 2 and i + 2 < len(toks) else set()
                        cands |= {k for (k, _) in idxL.get((ns[i - 2], left), ())} if i >= 2 else set()
                        if cands and not any(k.isdigit() for k in cands):
                            edits.append((i, tok, "", "d"))
                    continue
                letters = re.sub(r"[^A-Za-z]", "", tok)
                fragment = i == 0 and 1 <= len(letters) <= 3 and n.isalpha() and (
                    letters.isupper() or re.search(r"[A-Z]", letters[1:]) is not None)
                is_bad = bad(tok)
                if not (is_bad or fragment or (is_start and i == 0)):
                    continue
                new = None
                rule = None
                # (a) mesmo contexto na outra digitalização: 4 palavras (2 antes, 2 depois)
                if 2 <= i and i + 2 < len(toks) and all(ns[k] and not bad(toks[k]) for k in (i - 2, i - 1, i + 1, i + 2)):
                    c = idx4.get((ns[i - 2], ns[i - 1], ns[i + 1], ns[i + 2]))
                    hit = cand_alt(c) if c else None
                    if hit and ok_alt(n, hit[0]):
                        new, rule = hit[1], "a"
                elif i <= 1 and i + 2 < len(toks) and all(ns[k] and not bad(toks[k]) for k in (i + 1, i + 2)):
                    c = idxR.get((ns[i + 1], ns[i + 2]))
                    hit = cand_alt(c) if c else None
                    if hit and ok_alt(n, hit[0]) and (is_bad or fragment):
                        new, rule = hit[1], "a"
                if new is None and is_bad and not junk(tok):
                    # (b) uma única confusão típica de OCR que dá palavra do dicionário
                    base = "".join(tok_parts(tok))
                    variants = set()
                    for a_, b_ in CONF:
                        start = 0
                        while (k := base.find(a_, start)) >= 0:
                            v = base[:k] + b_ + base[k + len(a_):]
                            if v in words:
                                variants.add(v)
                            start = k + 1
                    variants = {v for v in variants if alt_counts[v] >= 1}
                    if (len(variants) == 1 and len(tok_parts(tok)) == 1 and not re.search(r"[a-z][A-Z]", tok)
                            and (len(base) >= 3 or any(ch.isdigit() for ch in base))):
                        v = next(iter(variants))
                        new = v.upper() if tok.isupper() and len(tok) > 1 else (
                            v.capitalize() if tok[:1].isupper() else v)
                        rule = "b"
                if new is None and is_bad and junk(tok) and re.match(r"^[~|<>^\\]+[A-Za-z]", tok):
                    # (d) símbolo de linha colado na frente da palavra: ruído, sai
                    new, rule = re.sub(r"^[~|<>^\\]+", "", tok), "d"
                    edits.append((i, tok, new, rule))
                    continue
                # (c) só para o que não é palavra (ITH, OME) ou para as capitulares típicas do livro (HE, HIS, ORE)
                if is_start and i == 0 and not (letters.isupper() and 2 <= len(letters) <= 5 and not junk(tok)):
                    stats["início de seção: sem capitular em maiúsculas (mantida)"] += 1
                if is_start and i == 0 and letters.isupper() and 2 <= len(letters) <= 5 and not junk(tok) \
                        and i + 1 < len(ns) and ns[i + 1]:
                    # (c2) capitular em início de seção: a letra restaurada forma par válido com a palavra seguinte
                    # (visto no outro scan ou no texto) e o par com a palavra como está não aparece
                    orig_pair = our_bi[(n, ns[i + 1])] - local[(n, ns[i + 1])]
                    # Candidata: forma o par com a palavra seguinte, ou é determinante e a palavra seguinte
                    # já aparece depois de algum determinante (the effort, no effort): "HE effort" -> "THE effort".
                    det_next = sum(bi_counts[(d, ns[i + 1])] for d in DETS)
                    good = [ch + n for ch in "abcdefghijklmnopqrstuvwxyz" if (ch + n) in words and (
                        bi_counts[(ch + n, ns[i + 1])] - local[(ch + n, ns[i + 1])] > 0
                        or (ch + n in DETS and det_next > 0))]
                    if orig_pair > 0:
                        stats["início de seção: palavra como está forma frase válida"] += 1
                    elif len(good) == 1:
                        v = good[0]
                        new = v.upper() if tok.isupper() else v.capitalize()
                        rule = "c2"
                        stats["início de seção: capitular restaurada (c2)"] += 1
                    elif good:
                        stats["início de seção: mais de uma capitular possível (mantida)"] += 1
                    else:
                        stats["início de seção: sem capitular que forme frase (mantida)"] += 1
                c_ok = letters.isupper() and len(letters) >= 2 and (
                    letters.lower() not in words or letters in ("HE", "HIS", "ORE", "OME", "ITH"))
                if new is None and fragment and c_ok and not junk(tok):
                    # (c) capitular perdida: uma letra à frente que dá palavra do dicionário
                    variants = {ch + n for ch in "abcdefghijklmnopqrstuvwxyz"
                                if (ch + n) in words or alt_counts[ch + n] >= 1}
                    if i + 1 < len(ns) and ns[i + 1]:
                        # desempate pela segunda palavra: só fica a letra que forma par já visto no outro scan
                        variants = {v for v in variants if (v, ns[i + 1]) in bigrams}
                    if len(variants) == 1:
                        v = next(iter(variants))
                        new = v.upper() if tok.isupper() else v.capitalize()
                        rule = "c"
                if new is not None and len(tok_parts(tok)) == 1:
                    m = re.match(r"^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$", tok)
                    edits.append((i, tok, m.group(1) + new + m.group(3), rule))
                elif is_bad and (garbage(tok, known) or (i == 0 and len(letters) == 1 and letters not in "aAI")):
                    unresolved.append(tok)
            key = A.para_key(para)
            if para[:1].islower() and prev_dropped:
                # continuação de um parágrafo que saiu: sem o início, não se atribui ao anterior
                unresolved.append("continuação de parágrafo descartado")
            prev_dropped = bool(unresolved)
            if unresolved:
                rows_out.append((key, -1, "drop", " ".join(unresolved)[:200], "", para[:70]))
                stats["descartados"] += 1
                stats["referências em descartados"] += len(A.find_refs(para))
                continue
            for i, orig, new, rule in edits:
                left = toks[i - 1] if i > 0 else ""
                right = toks[i + 1] if i + 1 < len(toks) else ""
                rows_out.append((key, i, rule, orig, new, f"{left} | {right} | {para[:50]}"))
                stats[f"regra {rule}"] += 1
        out = A.CORR_DIR / f"{sid}.tsv"
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            f.write("paragrafo_sha1_16\tidx\tregra\toriginal\tcorrigido\tcontexto_ou_inicio\n")
            for r in rows_out:
                f.write("\t".join(str(x).replace("\t", " ").replace("\n", " ") for x in r) + "\n")
        print(sid, dict(stats), "->", out)


if __name__ == "__main__":
    main()
