"""Descrição das localizações do openbible-geo traduzida por regra, nas línguas que não são pt. Funções puras.

O ingestor (ingest/openbible-geo.py) escreve a descrição com frases de fórmula fixa, sempre nesta ordem; só a primeira
é obrigatória:
  Best modern identification: NOME (TIPO, GEOMETRIA geometry); association score N/1000.
  Identification: "TEXTO" (modern|ancient).
  Votes: chave N, chave N, ...
  Time-weighted score N/1000.
  N other candidate modern location(s) in the dataset.
Lugar sem localização moderna ('No modern location is associated…') não é analisado: fica sem tradução por regra.

Nome moderno e texto da identificação ficam como na fonte (inglês) no pt. Nas outras línguas, com a opção
geo_omitir_ingles = sim (gramática), o inglês some: a identificação entre aspas que for frase em inglês ('another name
for Acco', 'in the Valley of Siddim') sai com a frase inteira, e o nome moderno em inglês ('Jezreel Valley', 'near the
mouth of the Jordan River') sai, trocando geo_melhor por geo_melhor_sem_nome (o tipo já diz o que é). Nome próprio
simples ('Tel Avdon', 'Abarim') fica. Tipo, geometria, fonte e votos vêm do glossário geo da língua
(corrections/<xx>/glossario-geo.tsv, seções tipo, geometria, voto, fonte); o texto das frases vem da gramática da língua
(chaves geo_*, em corrections/<xx>/gramatica-descricoes.tsv). Termo ou chave que falta: Falha, e a descrição cai na
tradução automática (ou no TSV revisado, se houver).

Línguas de outra escrita (zh ja hi bn ur ar ru) com geo_omitir_ingles = sim: nome moderno ou identificação em letras
latinas (escrita_ok) é trocado pelo nome da entidade na língua (nomes: nome-base inglês -> nome da língua, como em
descricoes_pt._nome); sem nome na língua, o trecho sai, e números e votos ficam. O pt e as línguas latinas não mudam.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass

from sensus.descricoes_pt import Falha, Gramatica, modelo_de, preenche
from sensus.escritas import LATINAS, escrita_ok
from sensus.names_pt import base_name

SECOES_GEO = ("tipo", "geometria", "voto", "fonte")

# Chaves da gramática usadas só pela descrição geo (EXEMPLO_EN mostra a frase de origem para o agente).
CHAVES_GEO = ("geo_melhor", "geo_melhor_sem_nome", "geo_identificacao", "geo_votos", "geo_voto", "geo_tempo",
              "geo_outros", "geo_omitir_ingles")
EXEMPLO_EN = {
    "geo_melhor": "Best modern identification: {nome} ({tipo}, {geometria} geometry); association score {score}/1000.",
    "geo_melhor_sem_nome": "Best modern identification ({tipo}, {geometria} geometry); association score {score}/1000.",
    "geo_identificacao": 'Identification: "{texto}" ({fonte}).',
    "geo_votos": "Votes: {votos}.",
    "geo_voto": "{voto} {n}",
    "geo_tempo": "Time-weighted score {tempo}/1000.",
    "geo_outros": "{n} other candidate modern location(s) in the dataset.",
    "geo_omitir_ingles": "sim (omite o inglês: nome moderno e identificação em inglês; ver geo_descricao.py)",
}

# Palavras inglesas que denunciam frase, não nome próprio ('another name for', 'in the Valley of', 'near the mouth').
_PALAVRAS_INGLESAS = frozenset((
    "a", "an", "the", "of", "in", "on", "at", "to", "from", "by", "for", "with", "and", "or", "near", "along",
    "between", "another", "name", "south", "north", "east", "west", "is", "was", "possibly", "probably", "ancient",
    "modern",
))
# Substantivos ingleses de acidente geográfico: 'Jezreel Valley', 'Barada River' (o tipo já diz 'vale', 'rio').
_SUBSTANTIVOS_INGLESES = frozenset((
    "river", "valley", "mountain", "mountains", "lake", "sea", "spring", "springs", "hill", "hills", "brook", "plain", "desert", "ridge", "stream", "creek", "mount", "island", "bay", "gulf", "canyon", "ruins", "pool", "pools",
    "well", "wells", "fountain",
))


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


def _em_latim(lingua: str | None, texto: str | None) -> bool:
    """Trecho com letras latinas numa língua de outra escrita. Língua latina ou None, texto sem letra: False."""
    if lingua is None or lingua in LATINAS or not texto or not any(c.isalpha() for c in texto):
        return False
    return not escrita_ok(lingua, texto)


def _na_lingua(nomes: Mapping[str, str] | None, texto: str) -> str | None:
    """Nome da língua do texto inglês, pelo nome-base (como descricoes_pt._nome); None se a língua não tem o nome."""
    base = base_name(texto) if nomes else None
    return nomes.get(base) if base else None


def _termo(glos: dict, secao: str, chave: str) -> str:
    if chave not in glos.get(secao, {}):
        raise Falha(f"{secao}: {chave}")
    return glos[secao][chave]


def e_ingles(texto: str) -> bool:
    """True se o texto é frase ou nome em inglês: traz palavra de ligação inglesa ou substantivo geográfico inglês.
    Vale para palavra inicial maiúscula também ('The Stone Pavement'). Nome de origem semítica não tem essas palavras."""
    return any(p.lower() in _PALAVRAS_INGLESAS or p.lower() in _SUBSTANTIVOS_INGLESES
               for p in re.findall(r"[A-Za-z]+", texto))


def _renderiza(geo: Geo, glos: dict, gram: Gramatica, lingua: str | None, nomes: Mapping[str, str] | None) -> str:
    lista_sep = modelo_de(gram, "lista_sep")
    omitir = gram.get("geo_omitir_ingles", "nao") == "sim"
    campos = {
        "tipo": _termo(glos, "tipo", geo.tipo),
        "geometria": _termo(glos, "geometria", geo.geometria),
        "score": str(geo.score),
    }
    if omitir and _em_latim(lingua, geo.nome):
        traduzido = _na_lingua(nomes, geo.nome)
        cabeca = modelo_de(gram, "geo_melhor" if traduzido is not None else "geo_melhor_sem_nome")
        if traduzido is not None:
            campos["nome"] = traduzido
    elif omitir and " " in geo.nome and e_ingles(geo.nome):
        cabeca = modelo_de(gram, "geo_melhor_sem_nome")
    else:
        cabeca = modelo_de(gram, "geo_melhor")
        campos["nome"] = geo.nome
    partes = [preenche(cabeca, campos)]
    ident = geo.identificacao
    if ident is not None:
        if omitir and _em_latim(lingua, ident):
            ident = _na_lingua(nomes, ident)
        elif omitir and e_ingles(ident):
            ident = None
    if ident is not None:
        partes.append(preenche(modelo_de(gram, "geo_identificacao"), {
            "texto": ident,
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


def renderiza(geo: Geo, glossario: dict, gramatica: Gramatica, falhas: list[str] | None = None,
              lingua: str | None = None, nomes: Mapping[str, str] | None = None) -> str | None:
    """Descrição na língua a partir da análise; None se falta termo do glossário geo ou chave da gramática.

    falhas: se for uma lista, recebe o termo ou a chave que faltou (relatório de cobertura).
    lingua: a língua (para saber se a escrita é latina); None = sem regra de escrita (como antes).
    nomes: nome-base inglês -> nome da língua (ver _na_lingua); sem ele, o trecho em letras latinas sai.
    """
    try:
        return _renderiza(geo, glossario, gramatica, lingua, nomes)
    except Falha as falha:
        if falhas is not None:
            falhas.append(str(falha))
        return None
