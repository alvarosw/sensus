"""Descrição das localizações do openbible-geo traduzida por regra, nas línguas que não são pt. Funções puras.

O ingestor (ingest/openbible-geo.py) escreve a descrição com frases de fórmula fixa, sempre nesta ordem; só a primeira
é obrigatória:
  Best modern identification: NOME (TIPO, GEOMETRIA geometry); association score N/1000.
  Identification: "TEXTO" (modern|ancient).
  Votes: chave N, chave N, ...
  Time-weighted score N/1000.
  N other candidate modern location(s) in the dataset.
Lugar sem localização moderna ('No modern location is associated…') não é analisado: fica sem tradução por regra.

Nome moderno e texto da identificação ficam como na fonte (inglês), como no pt. Tipo, geometria, fonte e votos vêm do
glossário geo da língua (corrections/<xx>/glossario-geo.tsv, seções tipo, geometria, voto, fonte); o texto das frases
vem da gramática da língua (chaves geo_*, em corrections/<xx>/gramatica-descricoes.tsv). Termo ou chave que falta:
Falha, e a descrição cai na tradução automática (ou no TSV revisado, se houver).
"""

import re
from dataclasses import dataclass

from sensus.descricoes_pt import Falha, Gramatica, modelo_de, preenche

SECOES_GEO = ("tipo", "geometria", "voto", "fonte")

# Chaves da gramática usadas só pela descrição geo (EXEMPLO_EN mostra a frase de origem para o agente).
CHAVES_GEO = ("geo_melhor", "geo_identificacao", "geo_votos", "geo_voto", "geo_tempo", "geo_outros")
EXEMPLO_EN = {
    "geo_melhor": "Best modern identification: {nome} ({tipo}, {geometria} geometry); association score {score}/1000.",
    "geo_identificacao": 'Identification: "{texto}" ({fonte}).',
    "geo_votos": "Votes: {votos}.",
    "geo_voto": "{voto} {n}",
    "geo_tempo": "Time-weighted score {tempo}/1000.",
    "geo_outros": "{n} other candidate modern location(s) in the dataset.",
}


@dataclass(frozen=True)
class Geo:
    nome: str
    tipo: str
    geometria: str
    score: int
    identificacao: str | None = None
    fonte: str | None = None
    votos: tuple[tuple[str, int], ...] = ()
    tempo: int | None = None
    outros: int = 0


_CABECA = re.compile(
    r"Best modern identification: (?P<nome>.+?) \((?P<tipo>[^,()]+), (?P<geo>[^,()]+) geometry\); "
    r"association score (?P<score>\d+)/1000\."
)
_IDENT = re.compile(r' Identification: "(?P<texto>.*?)" \((?P<fonte>modern|ancient)\)\.')
_VOTOS = re.compile(r" Votes: (?P<votos>[a-z_]+ \d+(?:, [a-z_]+ \d+)*)\.")
_TEMPO = re.compile(r" Time-weighted score (?P<tempo>\d+)/1000\.")
_OUTROS = re.compile(r" (?P<n>\d+) other candidate modern location\(s\) in the dataset\.")


def analisa(texto: str) -> Geo | None:
    """Campos da descrição do openbible-geo; None se o texto não tem a frase 'Best modern identification' inteira
    ou sobra trecho que a análise não conhece."""
    m = _CABECA.match(texto or "")
    if not m:
        return None
    resto = texto[m.end():]
    campos: dict = {}
    for rx in (_IDENT, _VOTOS, _TEMPO, _OUTROS):
        mm = rx.match(resto)
        if mm is None:
            continue
        resto = resto[mm.end():]
        if rx is _IDENT:
            campos["identificacao"], campos["fonte"] = mm.group("texto"), mm.group("fonte")
        elif rx is _VOTOS:
            campos["votos"] = tuple((k, int(n)) for k, n in re.findall(r"([a-z_]+) (\d+)", mm.group("votos")))
        elif rx is _TEMPO:
            campos["tempo"] = int(mm.group("tempo"))
        else:
            campos["outros"] = int(mm.group("n"))
    if resto:
        return None
    return Geo(nome=m.group("nome"), tipo=m.group("tipo"), geometria=m.group("geo"), score=int(m.group("score")),
               **campos)


def _termo(glos: dict, secao: str, chave: str) -> str:
    if chave not in glos.get(secao, {}):
        raise Falha(f"{secao}: {chave}")
    return glos[secao][chave]


def _renderiza(geo: Geo, glos: dict, gram: Gramatica) -> str:
    lista_sep = modelo_de(gram, "lista_sep")
    partes = [preenche(modelo_de(gram, "geo_melhor"), {
        "nome": geo.nome,
        "tipo": _termo(glos, "tipo", geo.tipo),
        "geometria": _termo(glos, "geometria", geo.geometria),
        "score": str(geo.score),
    })]
    if geo.identificacao is not None:
        partes.append(preenche(modelo_de(gram, "geo_identificacao"), {
            "texto": geo.identificacao,
            "fonte": _termo(glos, "fonte", geo.fonte or ""),
        }))
    if geo.votos:
        itens = [preenche(modelo_de(gram, "geo_voto"), {"voto": _termo(glos, "voto", k), "n": str(n)})
                 for k, n in geo.votos]
        partes.append(preenche(modelo_de(gram, "geo_votos"), {"votos": lista_sep.join(itens)}))
    if geo.tempo is not None:
        partes.append(preenche(modelo_de(gram, "geo_tempo"), {"tempo": str(geo.tempo)}))
    if geo.outros:
        partes.append(preenche(modelo_de(gram, "geo_outros"), {"n": str(geo.outros)}))
    return " ".join(partes)


def renderiza(geo: Geo, glossario: dict, gramatica: Gramatica, falhas: list[str] | None = None) -> str | None:
    """Descrição na língua a partir da análise; None se falta termo do glossário geo ou chave da gramática.

    falhas: se for uma lista, recebe o termo ou a chave que faltou (relatório de cobertura).
    """
    try:
        return _renderiza(geo, glossario, gramatica)
    except Falha as falha:
        if falhas is not None:
            falhas.append(str(falha))
        return None
