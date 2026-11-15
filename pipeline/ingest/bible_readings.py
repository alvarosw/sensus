"""Ingere Bible Readings for the Home Circle (Review & Herald, edição revista e ampliada de 1920) como comentário.

Fonte 'bible-readings', kind 'commentary', tradition 'adventist'. O livro é em perguntas e respostas: 200 estudos
("readings"), cada um com perguntas numeradas, e a resposta é quase sempre uma citação bíblica com referência.

Cada PERGUNTA + RESPOSTA vira uma unidade. (adventist_pd.py não serve aqui: o filtro de "parágrafo só de citação"
apagaria as respostas.) Cada referência inequívoca da resposta (ingest/refparse.py) gera uma linha com
cite_id com:<source>:<início>-<fim>. O texto da linha é "Bible Readings for the Home Circle, cap. N — <título do
estudo>", uma linha em branco, a pergunta, uma linha em branco e a resposta.

Regras:
- Estudo numerado pela ordem do livro (1 a 200). Título: o bloco de texto logo antes da ilustração do estudo (o
  título vem antes de "[Illustration.]" e da legenda). O sumário e os títulos de Part (PART I. ...) não entram.
- Ilustrações e legendas ("[Illustration.]" e a linha seguinte) saem. Nota editorial ("NOTE.—") fica com a
  resposta anterior, porque é o comentário daquela pergunta.
- Índice de assuntos (INDEX OF SUBJECTS) e o restante do Gutenberg saem.
- Referência ambígua (Phil. sem capítulo:versículo) descarta a resposta inteira, como em adventist_pd.py.
- "Verse N" (que se refere ao capítulo da citação anterior) não é ligado: o refparse não tem o capítulo de contexto.
  A contagem sai no fim da execução.
- Algarismos romanos: o texto não traz nenhuma referência em romanos (conferido), então o refparse não foi alterado.
- Texto em inglês, como nas demais fontes de comentário.

Uso:
    cd pipeline && .venv/bin/python -I ingest/bible_readings.py
"""

import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import RAW, StagingWriter, cite_com  # noqa: E402
from ingest.refparse import find_refs  # noqa: E402
from ingest.adventist_pd import (  # noqa: E402
    BARE_PHIL, GUT_END, GUT_ITALIC, GUT_LICENSE_URL, GUT_START, fetch, sha256_of,
)

SOURCE_ID = "bible-readings"
URL = "https://www.gutenberg.org/ebooks/34520"
FETCH_URL = "https://www.gutenberg.org/cache/epub/34520/pg34520.txt"
RAW_NAME = "pg34520.txt"
TITLE = "Bible Readings for the Home Circle"
HEAD = "Bible Readings for the Home Circle"

PERGUNTA = re.compile(r"^(\d{1,3})\. ")
PARTE = re.compile(r"^PART [IVXL]+\. ")
FIM_DO_LIVRO = re.compile(r"^\s*INDEX OF SUBJECTS\s*$", re.M)


def carrega(path: Path) -> str:
    """Corpo do livro: entre os marcadores do Gutenberg, sem o índice de assuntos."""
    raw = path.read_bytes().decode("utf-8", errors="replace").replace("\r", "")
    m, e = GUT_START.search(raw), GUT_END.search(raw)
    if not m or not e:
        raise RuntimeError("marcadores START/END do Project Gutenberg não encontrados")
    body = raw[m.end():e.start()]
    body = GUT_ITALIC.sub(r"\1", body)  # itálico do Gutenberg: _palavra_
    corte = FIM_DO_LIVRO.search(body)
    return body[:corte.start()] if corte else body


def blocos(body: str) -> list[list[str]]:
    """Parágrafos: grupos de linhas não vazias separados por linha em branco (linhas sem espaço nas pontas)."""
    out: list[list[str]] = []
    atual: list[str] = []
    for ln in body.split("\n"):
        if ln.strip():
            atual.append(ln.rstrip())
        elif atual:
            out.append(atual)
            atual = []
    if atual:
        out.append(atual)
    return out


def classifica(bl: list[list[str]]) -> list[str]:
    """Tipo de cada bloco: ill (ilustração), cap (legenda, logo depois de ilustração), part, q (pergunta), txt."""
    kinds = []
    for i, b in enumerate(bl):
        first = b[0]
        if first.strip().startswith("[Illustration"):
            kinds.append("ill")
        elif i > 0 and kinds[i - 1] == "ill":
            kinds.append("cap")
        elif PARTE.match(first.strip()):
            kinds.append("part")
        elif PERGUNTA.match(first):  # sem espaço antes: linha com recuo é nota ou lista, não pergunta
            kinds.append("q")
        else:
            kinds.append("txt")
    return kinds


def junta(bloco: list[str]) -> str:
    return " ".join(" ".join(bloco).split())


def titulo_antes(bl: list[list[str]], kinds: list[str], j: int) -> int | None:
    """Índice do bloco com o título do estudo cuja primeira pergunta está em j (anda para trás pela ilustração)."""
    k = j - 1
    while k >= 0 and kinds[k] in ("ill", "cap"):
        k -= 1
    if k < 0 or kinds[k] != "txt":
        return None
    return k


def estudos(body: str):
    """Lista de (número, título, [(pergunta, resposta)]), na ordem do livro."""
    bl = blocos(body)
    kinds = classifica(bl)
    inicios = []  # (índice do bloco do título)
    for j, kd in enumerate(kinds):
        if kd == "q" and PERGUNTA.match(bl[j][0]).group(1) == "1":
            t = titulo_antes(bl, kinds, j)
            if t is None:
                raise RuntimeError(f"estudo sem título antes da pergunta 1 (bloco {j})")
            inicios.append(t)
    fim = [*inicios[1:], len(bl)]
    out = []
    for n, (ini, nxt) in enumerate(zip(inicios, fim), 1):
        titulo = junta(bl[ini])
        perguntas: list[list] = []  # [pergunta, [blocos da resposta]]
        esperada = 1
        for k in range(ini + 1, nxt):
            if kinds[k] in ("ill", "cap", "part"):
                continue
            if kinds[k] == "q" and int(PERGUNTA.match(bl[k][0]).group(1)) == esperada:
                texto = PERGUNTA.sub("", " ".join(bl[k]).lstrip(), count=1)
                perguntas.append([junta([texto]), []])
                esperada += 1
            elif perguntas:
                perguntas[-1][1].append(bl[k])
        out.append((n, titulo, [(p, junta([x for b in r for x in b])) for p, r in perguntas]))
    return out


def linhas(body: str, stats: Counter):
    """(início, fim, texto) de cada referência das respostas, na ordem do livro."""
    rows = []
    for n, titulo, pares in estudos(body):
        stats["estudos"] += 1
        head = f"{HEAD}, cap. {n} — {titulo}"
        for pergunta, resposta in pares:
            stats["perguntas"] += 1
            # Item sem resposta (lista de princípios "Worship. Jer. 10:10-12; ..."): as referências estão na própria pergunta.
            fonte = resposta or pergunta
            if not resposta:
                stats["itens sem resposta (referências na pergunta)"] += 1
            if re.search(r"\bVerses?\s+\d", fonte):
                stats["respostas com \"Verse N\" (não ligadas)"] += 1
            refs = list(find_refs(fonte))
            if not refs:
                stats["respostas sem referência"] += 1
                continue
            if BARE_PHIL.search(fonte):
                stats["descartadas: referência ambígua (Phil. sem capítulo:versículo)"] += len(refs)
                continue
            text = f"{head}\n\n{pergunta}\n\n{resposta}" if resposta else f"{head}\n\n{pergunta}"
            stats["perguntas com referência"] += 1
            stats["referências"] += len(refs)
            for s, e in refs:
                rows.append((s, e, text))
    return rows


def ingest() -> None:
    path = fetch(FETCH_URL, RAW / SOURCE_ID / RAW_NAME)
    digest = sha256_of(path)
    stats: Counter = Counter()
    rows = linhas(carrega(path), stats)
    print(f"[{SOURCE_ID}] {dict(stats)}")
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="commentary",
            title=TITLE,
            author="Review & Herald Publishing Association (obra coletiva)",
            lang="en",
            license="Public Domain",
            license_url=GUT_LICENSE_URL,
            url=URL,
            version=f"Review & Herald, 1920 (New, Revised, and Enlarged Edition); arquivo {RAW_NAME} sha256 {digest[:16]}",
            attribution=(
                f"{TITLE}. Review & Herald Publishing Association, 1920 (edição revista e ampliada). Fonte do texto: "
                "Project Gutenberg eBook #34520, sem o cabeçalho e o rodapé da licença do Project Gutenberg. Domínio "
                "público: publicado em 1920, em domínio público nos EUA (o Gutenberg indica \"Public domain in the "
                "USA\"); no Brasil, obra coletiva publicada há mais de 70 anos."
            ),
            tradition="adventist",
            notes=(
                "Perguntas e respostas: cada pergunta com a sua resposta é uma unidade. Cada referência inequívoca da "
                "resposta gera uma linha. O cabeçalho do verbete traz o estudo (cap. N) e o título. Referências ambíguas "
                "(Phil. sem capítulo:versículo) descartadas. \"Verse N\" não é ligado. Texto em inglês."
            ),
        )
        seen: Counter = Counter()
        for start, end, text in sorted(rows, key=lambda r: (r[0], r[1])):
            base = cite_com(SOURCE_ID, start, end)
            seen[base] += 1
            cite = base if seen[base] == 1 else f"{base}.{seen[base]}"
            w.row("commentary", cite_id=cite, start_vid=start, end_vid=end, text=text)


if __name__ == "__main__":
    ingest()
