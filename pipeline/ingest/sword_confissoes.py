"""Ingere confissões de fé e catecismos reformados (módulos RawGenBook do CrossWire, domínio público) como comentários
por referência.

Uma source por módulo ('sword-westminster' ...). Cada artigo (seção numerada de capítulo, pergunta de catecismo)
que cita versículos nas provas vira uma linha por referência, como em adventist_pd: cite com:<source>:<início>-<fim>.
O texto da linha é "<obra>, <rótulo> — " seguido do artigo, sem as listas de provas (notas do OSIS). Artigo sem
prova não gera linha. Referência OSIS que não vira vid (ex.: Matt.3.21) sai, com contagem.

Uso:
    cd pipeline && .venv/bin/python -I ingest/sword_confissoes.py [sword-westminster]
"""

import html
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import StagingWriter, cite_com  # noqa: E402
from ingest.refparse import find_refs  # noqa: E402
from ingest.sword_common import BASE_URL, download, extract, read_conf  # noqa: E402
from ingest.sword_genbook import GenBookNode, read_genbook  # noqa: E402

_NOTA = re.compile(r"<note\b[^>]*>.*?</note\s*>", re.S | re.I)
_MARCA = re.compile(r"\x00(\d+)\x00")
_PARAGRAFO = re.compile(r"<p\b[^>]*>", re.I)
_TITULO = re.compile(r"<title\b[^>]*>.*?</title\s*>", re.S | re.I)
_REFERENCIA = re.compile(
    r"<(?:reference|scripRef)\b[^>]*\bosisRef=\"[^\"]*\"[^>]*>.*?</(?:reference|scripRef)\s*>", re.S | re.I)
_TAG = re.compile(r"<[^>]*>")
# Rótulos no início do parágrafo: "I. " (seção da Westminster), "Paragraph 1 " (1689) e "Q. 1. " (perguntas).
_ROTULO_CAP = re.compile(r"^(?:Paragraph\s+(\d+)|([IVXLCDM]+)\.)\s+")
_ROTULO_Q = re.compile(r"^Q\.\s*(\d+)\.\s+")
_ROMANO = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


@dataclass
class Artigo:
    rotulo: str  # "ch. 1, sec. 1" ou "Q. 1" (sem o nome da obra)
    texto: str  # artigo sem o rótulo e sem as listas de provas
    refs: list[tuple[int, int]] = field(default_factory=list)
    nao_reconhecidas: int = 0  # osisRef que não virou vid (ex.: livro fora do cânon de 66)


@dataclass
class _Paragrafo:
    rotulo: str | None  # "ch. N, sec. M", "Q. N" ou None (continua o artigo anterior)
    texto: str
    refs: list[tuple[int, int]]
    nao_reconhecidas: int


def romano(s: str) -> int:
    total, anterior = 0, 0
    for ch in reversed(s.upper()):
        v = _ROMANO[ch]
        total += -v if v < anterior else v
        anterior = max(anterior, v)
    return total


def numero_capitulo(nome: str) -> int:
    """'Chapter XII' (Westminster) ou 'Chapter 12' (1689) -> 12."""
    m = re.fullmatch(r"Chapter\s+(\d+|[IVXLC]+)", nome)
    if not m:
        raise ValueError(f"nome de capítulo inesperado: {nome!r}")
    g = m.group(1)
    return int(g) if g.isdigit() else romano(g)


def _limpa(s: str) -> str:
    s = html.unescape(s).replace("\\", "").replace("\xa0", " ")  # "\." é resto de marcação do módulo
    return re.sub(r"\s+", " ", s).strip()


def _junta(a: str, b: str) -> str:
    return " ".join(x for x in (a, b) if x)


def _refs(markup: str) -> tuple[list[tuple[int, int]], int]:
    """Referências de cada elemento osisRef (texto de prova) e quantas não viraram vid."""
    refs: list[tuple[int, int]] = []
    nao = 0
    for elemento in _REFERENCIA.findall(markup):
        achadas = find_refs(elemento)
        if not achadas:
            nao += 1
        refs += [r for r in achadas if r not in refs]
    return refs, nao


def _paragrafos(osis: str, modo: str) -> list[_Paragrafo]:
    """Parágrafos do nó, com rótulo (se começam numerados) e as provas das notas que pertencem a eles."""
    notas: list[str] = []

    def guarda(m: re.Match) -> str:
        notas.append(m.group(0))
        return f"\x00{len(notas) - 1}\x00"

    marcado = _NOTA.sub(guarda, osis)
    out: list[_Paragrafo] = []
    for trecho in _PARAGRAFO.split(marcado):
        com_notas = _MARCA.sub(lambda m: notas[int(m.group(1))], trecho)
        sem_marca = _MARCA.sub(" ", trecho)
        refs, nao = _refs(com_notas)
        completo = _limpa(_TAG.sub(" ", sem_marca))  # títulos entram: "Q. 1. ..." e "Paragraph 1" são títulos
        m = (_ROTULO_Q if modo == "q" else _ROTULO_CAP).match(completo)
        if m:
            if modo == "q":
                rotulo = f"Q. {int(m.group(1))}"
            elif m.group(1):
                rotulo = f"sec. {int(m.group(1))}"  # ainda sem o capítulo: montado em artigos()
            else:
                rotulo = f"sec. {romano(m.group(2))}"
            texto = completo[m.end():]
        else:
            rotulo = None
            texto = _limpa(_TAG.sub(" ", _TITULO.sub(" ", sem_marca)))  # título de capítulo não é prosa
        if texto or refs:
            out.append(_Paragrafo(rotulo, texto, refs, nao))
    return out


def artigos(osis: str, modo: str, capitulo: int | None = None) -> list[Artigo]:
    """Artigos de um nó OSIS.

    modo 'cap': seções numeradas de um capítulo ("I.", "Paragraph 1"); capitulo é obrigatório. Um nó sem nenhum
      rótulo (ex.: capítulo XII da Westminster, que é uma seção só) vira um artigo, sec. 1.
    modo 'q': perguntas de catecismo ("Q. 1."). Texto sem pergunta antes da primeira é cabeçalho e sai.
    Parágrafo sem rótulo segue o artigo anterior (texto e provas).
    """
    if modo not in ("cap", "q"):
        raise ValueError(f"modo desconhecido: {modo!r}")
    if modo == "cap" and capitulo is None:
        raise ValueError("modo 'cap' pede o número do capítulo")
    paragrafos = _paragrafos(osis, modo)
    if not any(p.rotulo for p in paragrafos):
        if modo == "q":
            raise ValueError("catecismo sem perguntas numeradas")
        if not paragrafos:
            return []
        unico = _Paragrafo("sec. 1", "", [], 0)
        for p in paragrafos:
            unico.texto = _junta(unico.texto, p.texto)
            unico.refs += [r for r in p.refs if r not in unico.refs]
            unico.nao_reconhecidas += p.nao_reconhecidas
        paragrafos = [unico]
    out: list[Artigo] = []
    atual: Artigo | None = None
    for p in paragrafos:
        if p.rotulo is not None:
            rotulo = p.rotulo if modo == "q" else f"ch. {capitulo}, {p.rotulo}"
            atual = Artigo(rotulo, p.texto, list(p.refs), p.nao_reconhecidas)
            out.append(atual)
        elif atual is not None:
            atual.texto = _junta(atual.texto, p.texto)
            atual.refs += [r for r in p.refs if r not in atual.refs]
            atual.nao_reconhecidas += p.nao_reconhecidas
    return out


# ---- módulos -------------------------------------------------------------------

def _lbcf(nos: list[GenBookNode]):
    """Confissão Batista de 1689: capítulos 'Chapter N' (o prefácio, o fim e o índice não entram)."""
    for n in nos:
        if n.text and n.name.startswith("Chapter "):
            yield "Baptist Confession of Faith of 1689", "cap", numero_capitulo(n.name), n.text


def _westminster(nos: list[GenBookNode]):
    """Confissão (capítulos sob 'WCF'), Breve (nó 'WSC') e Maior (nós 'Q…' sob 'WLC') catecismos."""
    for n in nos:
        if not n.text:
            continue
        if n.name.startswith("Chapter "):
            yield "Westminster Confession of Faith", "cap", numero_capitulo(n.name), n.text
        elif n.name == "WSC":
            yield "Westminster Shorter Catechism", "q", None, n.text
        elif n.name.startswith("Q") and n.depth == 1:
            yield "Westminster Larger Catechism", "q", None, n.text


@dataclass(frozen=True)
class Modulo:
    modulo: str  # nome do módulo no .conf
    zip_name: str  # arquivo no repositório rawzip
    source_id: str
    tradition: str
    author: str
    title: str
    extrai: object  # função(nos) -> (obra, modo, capitulo, texto) de cada nó com texto


MODULOS = [
    Modulo("Westminster", "Westminster.zip", "sword-westminster", "presbyterian",
           "Assembleia de Westminster (1643-1649)",
           "The Westminster Confession of Faith, with the Shorter and Larger Catechisms", _westminster),
    Modulo("BaptistConfession1689", "BaptistConfession1689.zip", "sword-lbcf1689", "reformed-baptist",
           "Igrejas batistas da Inglaterra e do País de Gales (1689)",
           "Baptist Confession of Faith of 1689", _lbcf),
]


def ingest(m: Modulo) -> None:
    zip_path = download(m.zip_name, m.source_id)
    root = extract(zip_path)
    conf = read_conf(root, m.modulo)
    if conf.get("moddrv") != "RawGenBook":
        raise RuntimeError(f"{m.modulo}: driver inesperado {conf.get('moddrv')!r}")
    if conf.get("distributionlicense") != "Public Domain":
        raise RuntimeError(f"{m.modulo}: licença inesperada {conf.get('distributionlicense')!r}")
    nos = read_genbook(root / conf["datapath"])

    contagem = Counter()
    linhas: list[tuple[int, int, str]] = []
    for obra, modo, capitulo, texto in m.extrai(nos):
        for art in artigos(texto, modo, capitulo):
            contagem["artigos"] += 1
            contagem["referências não reconhecidas"] += art.nao_reconhecidas
            if not art.refs:
                contagem["artigos sem prova (sem linha)"] += 1
                continue
            cab = f"{obra}, {art.rotulo} — "
            for start, end in art.refs:
                linhas.append((start, end, cab + art.texto))
            contagem["referências"] += len(art.refs)

    with StagingWriter(m.source_id) as w:
        w.source(
            kind="commentary",
            title=m.title,
            author=m.author,
            lang="en",
            license="Public Domain",
            license_url=None,
            url=BASE_URL + m.zip_name,
            version=f"{conf['version']} (SwordVersionDate {conf.get('swordversiondate', '?')})",
            attribution=(
                f"{m.title}, {m.author}. Módulo SWORD {m.modulo} v{conf['version']} (CrossWire Bible Society), "
                f"Public Domain conforme o .conf do módulo. Fonte do texto: {conf.get('textsource', '')}."
            ),
            tradition=m.tradition,
            notes=(
                "Confissão e catecismos por referência: cada artigo (seção, pergunta) gera uma linha por "
                "versículo citado nas provas. O texto sai sem as listas de provas. Referências OSIS sem vid "
                "são descartadas. Texto em inglês, como no original (1646-1649)."
            ),
        )
        seen: Counter = Counter()
        for start, end, texto in sorted(linhas, key=lambda r: (r[0], r[1])):
            base = cite_com(m.source_id, start, end)
            seen[base] += 1
            cite = base if seen[base] == 1 else f"{base}.{seen[base]}"
            w.row("commentary", cite_id=cite, start_vid=start, end_vid=end, text=texto)
    print(f"[{m.source_id}] {dict(contagem)} linhas={len(linhas)}")


def main() -> None:
    only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    for m in MODULOS:
        if only and m.source_id not in only:
            continue
        ingest(m)


if __name__ == "__main__":
    main()
