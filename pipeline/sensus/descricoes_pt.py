"""Descrições das entidades traduzidas por regra (entity_text), por língua. Funções puras (sem I/O).

Serve às fontes sensus-descricoes-<xx> (ingest/descricoes.py; pt: ingest/descricoes_pt.py). Só o stepbible-tipnr entra
aqui: as descrições dele seguem um modelo fixo (cabeçalho 'A man from the tribe of X living at the time of Y, first
mentioned at Gen.1.1)', linhas 'son of X;', 'only referred to as X (HEB);'). Cada parágrafo é reconhecido por uma
gramática inglesa pequena; a saída vem de uma GRAMÁTICA da língua (chave -> modelo, corrections/<xx>/gramatica-descricoes.tsv;
no pt, GRAMATICA_PT) e de um glossário da língua. Um parágrafo que a regra não reconhece, ou um termo fora do glossário,
faz a descrição inteira ficar sem tradução. O app então mostra a tradução automática, como para qualquer descrição sem
entity_text.

Gramática: cada modelo tem campos {nome} trocados pelo valor e sinais de pontuação {pont.;}, {pont..}, {pont.,}. A chave
'<chave>.f' é a forma para cargo feminino (coluna genero do glossário); sem ela, vale a forma comum. Chave ausente =
Falha (a descrição fica sem tradução). Gramática vazia não quebra: só não traduz nada.

Nomes próprios: o nome da língua de cada entidade citada vem de entity_name (cite_id ligado na fonte). Nome sem tradução
fica em inglês quando a gramática permite (nome_ingles_permitido = sim); em escrita não latina não permite.
Referências 'Exo.4.14' viram abreviaturas da língua (sensus/book_abbr.py, lidas de book-names.ts).

Regra nova = função pura com teste, com caso de AT hebraico e de NT grego (pipeline/tests).
"""

import re
from collections.abc import Mapping

from sensus import refs
from sensus.book_abbr import abreviaturas
from sensus.flexao import elisao_fr, genitivo_bn, genitivo_ru

# Seções do glossário (corrections/glossario-descricoes.tsv). Cada uma é um mapa inglês -> tradução.
SECOES = ("cargo", "tempo", "tribo", "lugar", "relacao", "nome")

Gramatica = dict[str, str]

# Gramática do português: reproduz as frases que o ingestor gerava antes da gramática ser separada. Não mude sem o
# teste de regressão (pipeline/tests/test_descricoes_pt.py) e a prova de sha256 do staging pt.
GRAMATICA_PT: Gramatica = {
    "mencao_primeira": "primeira menção em {ref}",
    "mencao_unica": "só aparece em {ref}",
    "frase_cargo_comp": "{cargo} {comp}",
    "frase_tempo_com_comp": "{frase}{pont.,} {tempo}",
    "frase_tempo_sem_comp": "{frase} {tempo}",
    "cabecalho": "{frase}{pont.;} {mencao}{pont..}",
    "comp_territorio_tribo": "no território da tribo de {tribo}{perto}",
    "comp_perto_sufixo": ", perto de {nome}",
    "comp_tribo": "da tribo de {tribo}",
    "comp_cidade": "da cidade de {nome}",
    "comp_perto": "perto de {nome}",
    "comp_de": "de {nome}",
    "comp_em": "em {nome}",
    "citacao": "Chamado de {lista}",
    "citacao_apenas": "Chamado apenas de {lista}",
    "original": " ({original})",
    "conector_e": " e ",
    "conector_ou": " ou ",
    "lista_sep": ", ",
    "pont.;": ";",
    "pont..": ".",
    "pont.,": ",",
    "maiuscula_inicial": "sim",
    "nome_ingles_permitido": "sim",
    "flexao_relacao": "nenhuma",
    "pos": "nenhum",
}

_PONT = (";", ".", ",")
_FLEXOES = ("nenhuma", "genitivo_ru", "genitivo_bn")
_POS = ("nenhum", "elisao_fr")
_GENEROS = ("", "m", "f", "n")

_REF = re.compile(r"(?P<livro>(?:LXX\.)?[1-3]?[A-Za-z]+)\.(?P<cap>\d+)\.(?P<ver>\d+)(?P<suf>[a-z]?)")
_REF_NA_FRASE = re.compile(r"\s(?:first|only) mentioned at (\S+)\)$")
_LISTA = re.compile(r", and | and |, or | or |, ")

# Abreviaturas do português (book-names.ts, idioma pt): usadas quando a chamada não passa outra tabela.
ABREV_PT = abreviaturas("pt")


class Termo(str):
    """Tradução de um termo do glossário. `genero` ('m', 'f', 'n' ou '') escolhe a forma '.f' da gramática."""

    genero: str

    def __new__(cls, texto: str, genero: str = ""):
        obj = super().__new__(cls, texto)
        obj.genero = genero
        return obj


class Falha(Exception):
    """A descrição tem trecho fora da gramática ou do glossário: o parágrafo (e a descrição) não é traduzido."""


def ler_glossario(texto: str, secoes: tuple[str, ...] = SECOES) -> dict[str, dict[str, Termo]]:
    """Glossário do TSV (secao, ingles, portugues, nota, genero). A coluna genero é opcional (m, f, n ou vazia).

    Erro com o número da linha para seção fora de `secoes`, termo vazio, gênero inválido ou termo repetido na mesma
    seção: o pipeline não traduz com um glossário ambíguo. Texto vazio = glossário vazio.
    """
    out: dict[str, dict[str, Termo]] = {s: {} for s in secoes}
    for n, linha in enumerate(texto.splitlines(), 1):
        if not linha.strip() or linha.startswith("#") or linha.startswith("secao\t"):
            continue
        campos = (linha.split("\t") + [""] * 5)[:5]
        secao, ingles, portugues, _nota, genero = campos
        if secao not in secoes:
            raise ValueError(f"glossário, linha {n}: seção inválida {secao!r} (use {', '.join(secoes)})")
        if not ingles or not portugues:
            raise ValueError(f"glossário, linha {n}: termo ou tradução vazio")
        if genero not in _GENEROS:
            raise ValueError(f"glossário, linha {n}: gênero inválido {genero!r} (use m, f, n ou vazio)")
        if ingles in out[secao]:
            raise ValueError(f"glossário, linha {n}: termo repetido em {secao}: {ingles!r}")
        out[secao][ingles] = Termo(portugues, genero)
    return out


def ler_gramatica(texto: str) -> Gramatica:
    """Gramática do TSV (chave<TAB>modelo). Texto vazio = gramática vazia (a língua não traduz nada por regra)."""
    linhas = [(n, l) for n, l in enumerate(texto.splitlines(), 1) if l.strip() and not l.startswith("#")]
    if not linhas:
        return {}
    (_, cabecalho), *corpo = linhas
    if cabecalho.split("\t") != ["chave", "modelo"]:
        raise ValueError(f"gramática: cabeçalho deve ser chave<TAB>modelo, veio {cabecalho!r}")
    out: Gramatica = {}
    for n, linha in corpo:
        campos = linha.split("\t")
        if len(campos) != 2 or not campos[0] or not campos[1].strip():
            raise ValueError(f"gramática, linha {n}: esperado chave<TAB>modelo, com os dois preenchidos")
        if campos[0] in out:
            raise ValueError(f"gramática, linha {n}: chave repetida {campos[0]!r}")
        out[campos[0]] = campos[1]
    return out


def ref_pt(ref: str, abrevs: list[str] | None = None) -> str | None:
    """'Exo.4.14' -> 'Êx 4:14' (com as abreviaturas `abrevs`, padrão pt); 'Psa.120.5' -> 'Sl 120:5'.

    None para o que não é um versículo só ou para livro fora do cânon.
    """
    m = _REF.fullmatch(ref)
    if not m:
        return None
    tabela = ABREV_PT if abrevs is None else abrevs
    try:
        num = refs.book_num(m.group("livro"))
    except KeyError:
        return None
    if not 1 <= num <= len(tabela):
        return None
    return f"{tabela[num - 1]} {int(m.group('cap'))}:{int(m.group('ver'))}{m.group('suf')}"


def modelo_de(gram: Mapping[str, str], chave: str, genero: str = "") -> str:
    """Modelo da chave; com genero 'f' usa '<chave>.f' quando a gramática tem essa forma. Chave ausente: Falha."""
    if genero == "f" and chave + ".f" in gram:
        return gram[chave + ".f"]
    if chave not in gram:
        raise Falha(chave)
    return gram[chave]


def preenche(modelo: str, campos: Mapping[str, str]) -> str:
    """Troca {campo} pelo valor. Chave cujo modelo sobra com '{' é erro de gramática: Falha."""
    for k, v in campos.items():
        modelo = modelo.replace("{" + k + "}", v)
    if "{" in modelo:
        raise Falha(modelo)
    return modelo


def _pontos(gram: Mapping[str, str]) -> dict[str, str]:
    return {"pont." + t: modelo_de(gram, "pont." + t) for t in _PONT}


def _pos(texto: str, gram: Mapping[str, str]) -> str:
    modo = gram.get("pos", "nenhum")
    if modo == "elisao_fr":
        return elisao_fr(texto)
    if modo not in _POS:
        raise ValueError(f"gramática: pos desconhecido {modo!r} (use {', '.join(_POS)})")
    return texto


def _junta(itens: list[str], sep: str, conector: str) -> str:
    """['A', 'B', 'C'], ', ', ' e ' -> 'A, B e C'."""
    if len(itens) <= 1:
        return "".join(itens)
    return sep.join(itens[:-1]) + conector + itens[-1]


def _flexiona(nomes_: list[str], modo: str) -> list[str]:
    """Genitivo dos nomes de uma relação (ru, bn). Nome que a flexão não decide: Falha."""
    if modo == "nenhuma":
        return nomes_
    if modo == "genitivo_ru":
        out = [genitivo_ru(x) for x in nomes_]
        for x, y in zip(nomes_, out):
            if y is None:
                raise Falha(x)
        return out
    if modo == "genitivo_bn":
        out = []
        for x in nomes_:
            try:
                out.append(genitivo_bn(x))
            except ValueError:
                raise Falha(x)
        return out
    raise ValueError(f"gramática: flexao_relacao desconhecida {modo!r} (use {', '.join(_FLEXOES)})")


def _eh_nome_ingles(x: str) -> bool:
    return bool(_EH_NOME.fullmatch(x)) and not x.startswith("The ")  # 'The Stone Pavement' é título, não nome


# Nome próprio: palavras com maiúscula inicial, ligadas por espaço ('Ben-hadad III', 'Abel-meholah'). 'the Kingdom of
# Israel' não é nome; sem tradução, um nome fica em inglês, mas uma expressão comum não passa.
_EH_NOME = re.compile(r"[A-Z][^\s]*(?: [A-Z][^\s]*)*(?:\(\?\))?")


def _nome(x: str, nomes: Mapping[str, str], glos: Mapping[str, Mapping[str, str]], gram: Mapping[str, str]) -> str:
    """Nome da língua de um nome inglês citado no texto: entity_name ligado (nomes), depois o glossário de termos de
    nomes (seção nome). Sem nenhum dos dois: inglês, se a gramática permite; senão Falha. '(?)' de dúvida é mantido."""
    if not _eh_nome_ingles(x):
        raise Falha(x)
    base, duvida = (x[:-3], "(?)") if x.endswith("(?)") else (x, "")
    traduzido = nomes.get(base) or glos.get("nome", {}).get(base)
    if traduzido is None:
        if gram.get("nome_ingles_permitido", "sim") != "sim":
            raise Falha(base)
        traduzido = base
    return traduzido + duvida


def _tribo(x: str, glos: Mapping[str, Mapping[str, str]]) -> str:
    """Nome de tribo (glossário, seção tribo); '(?)' de dúvida da fonte é mantido."""
    base, duvida = (x[:-3], "(?)") if x.endswith("(?)") else (x, "")
    if base not in glos.get("tribo", {}):
        raise Falha(x)
    return glos["tribo"][base] + duvida


def _complemento(resto: str, glos, nomes, gram, genero: str) -> str | None:
    """Complemento do cargo: 'from the tribe of Levi', 'near Abdon', 'of the city Admah', 'in Asia'."""
    if not resto:
        return ""
    if resto in glos.get("lugar", {}):
        return glos["lugar"][resto]
    m = re.fullmatch(r"in (.+) Tribe(?: near (.+))?", resto)  # 'in Judah Tribe near Tekoa'
    if m:
        perto = preenche(modelo_de(gram, "comp_perto_sufixo"), {"nome": _nome(m.group(2), nomes, glos, gram)}) \
            if m.group(2) else ""
        return preenche(modelo_de(gram, "comp_territorio_tribo", genero),
                        {"tribo": _tribo(m.group(1), glos), "perto": perto})
    m = re.fullmatch(r"from the tribe of (.+)", resto)
    if m:
        return preenche(modelo_de(gram, "comp_tribo", genero), {"tribo": _tribo(m.group(1), glos)})
    m = re.fullmatch(r"of the city (.+)", resto)
    if m:
        return preenche(modelo_de(gram, "comp_cidade", genero), {"nome": _nome(m.group(1), nomes, glos, gram)})
    m = re.fullmatch(r"near (.+)", resto)
    if m:
        return preenche(modelo_de(gram, "comp_perto", genero), {"nome": _nome(m.group(1), nomes, glos, gram)})
    m = re.fullmatch(r"(?:from|of) (.+)", resto)
    if m:
        return preenche(modelo_de(gram, "comp_de", genero), {"nome": _nome(m.group(1), nomes, glos, gram)})
    m = re.fullmatch(r"in (.+)", resto)
    if m:
        return preenche(modelo_de(gram, "comp_em", genero), {"nome": _nome(m.group(1), nomes, glos, gram)})
    raise Falha(resto)


def _cabecalho(p: str, glos, nomes, gram, abrevs: list[str]) -> str | None:
    """'A man from the tribe of Asher living at the time of Divided Monarchy, first mentioned at 1Ch.7.34)'
    -> 'Homem da tribo de Aser, da época da monarquia dividida; primeira menção em 1Cr 7:34.' (pt)."""
    m = re.match(r"^(?:A|An) (.+)$", p)
    if m:
        corpo = m.group(1)
    elif p.startswith("People "):  # 'People from Em(?), ...': o cargo 'people' fica no glossário
        corpo = p
    else:
        return None
    mm = _REF_NA_FRASE.search(corpo)
    if not mm:
        return None
    ref = ref_pt(mm.group(1), abrevs)
    if ref is None:
        return None
    mencao = preenche(modelo_de(gram, "mencao_primeira" if "first mentioned" in corpo else "mencao_unica"),
                      {"ref": ref})
    resto = corpo[: mm.start()].rstrip(", ")
    tempo = None
    mt = re.search(r"(?:^|\s)living (.+)$", resto)
    if mt:
        tempo = glos["tempo"].get(mt.group(1))
        if tempo is None:
            return None
        resto = resto[: mt.start()].rstrip(", ")
    # Cargo: a maior chave do glossário que abre a frase (com fronteira de palavra).
    cargo = None
    for chave in sorted(glos["cargo"], key=len, reverse=True):
        if resto == chave or resto.startswith(chave + " "):
            cargo = glos["cargo"][chave]
            resto = resto[len(chave):].strip()
            break
    if cargo is None:
        return None
    genero = getattr(cargo, "genero", "")
    complemento = _complemento(resto, glos, nomes, gram, genero)
    if complemento:
        frase = preenche(modelo_de(gram, "frase_cargo_comp"), {"cargo": cargo, "comp": complemento})
    else:
        frase = cargo
    if tempo:  # vírgula só quando já há complemento ('Sumo sacerdote da tribo de Levi, da época do Egito')
        chave = "frase_tempo_com_comp" if complemento else "frase_tempo_sem_comp"
        frase = preenche(modelo_de(gram, chave), {"frase": frase, "tempo": tempo, **_pontos(gram)})
    if gram.get("maiuscula_inicial", "sim") == "sim":
        frase = frase[:1].upper() + frase[1:]
    return preenche(modelo_de(gram, "cabecalho"), {"frase": frase, "mencao": mencao, **_pontos(gram)})


def _pont(gram, termino: str) -> str:
    """Sinal que fecha o parágrafo ('.' ou ';' do inglês), na pontuação da língua."""
    return modelo_de(gram, "pont." + termino)


def _citacao(p: str, glos, nomes, gram, abrevs: list[str]) -> str | None:
    """'only referred to as Abijah (אֲבִיָּה);' -> 'Chamado apenas de Abias (אֲבִיָּה);' (pt)."""
    m = re.fullmatch(r"(only )?referred to as (.+?)([;.])", p)
    if not m:
        return None
    itens = []
    for parte in re.split(r", or | or ", m.group(2)):
        mm = re.fullmatch(r"(.+?)(?: \(([^()]*)\))?", parte.strip())
        if not mm:
            return None
        nome = _nome(mm.group(1), nomes, glos, gram)
        if mm.group(2) is not None:
            nome += preenche(modelo_de(gram, "original"), {"original": mm.group(2)})
        itens.append(nome)
    lista = _junta(itens, modelo_de(gram, "lista_sep"), modelo_de(gram, "conector_ou"))
    chave = "citacao_apenas" if m.group(1) else "citacao"
    return preenche(modelo_de(gram, chave), {"lista": lista}) + _pont(gram, m.group(3))


def _relacao(p: str, glos, nomes, gram, abrevs: list[str]) -> str | None:
    """'a son of Gera;' -> 'filho de Gera;'; 'a brother of Joash, Joram and Athaliah.' -> 'irmão de Joás, ...'.

    Tradução de relação com {x} é o modelo (ex.: '{x}র ছেলে'); sem {x}, vale 'relação + espaço + nomes'.
    """
    m = re.fullmatch(r"(?:an? )?([a-z][a-z\- ]*? of):? (.+?)([;.])", p)
    if not m:
        return None
    relacao = glos.get("relacao", {}).get(m.group(1))
    if relacao is None:
        return None
    itens = [_nome(x, nomes, glos, gram) for x in _lista(m.group(2))]
    if not itens:
        return None
    itens = _flexiona(itens, gram.get("flexao_relacao", "nenhuma"))
    conector = modelo_de(gram, "conector_ou" if " or " in m.group(2) else "conector_e")
    lista = _junta(itens, modelo_de(gram, "lista_sep"), conector)
    texto = relacao.replace("{x}", lista) if "{x}" in relacao else f"{relacao} {lista}"
    return texto + _pont(gram, m.group(3))


def _lista(texto: str) -> list[str]:
    return [p.strip() for p in _LISTA.split(texto) if p.strip()]


def traduz_paragrafo(p: str, glos: Mapping[str, Mapping[str, str]], nomes: Mapping[str, str],
                     gram: Mapping[str, str] = GRAMATICA_PT, abrevs: list[str] | None = None,
                     falhas: list[str] | None = None) -> str | None:
    """Um parágrafo da descrição; None se a gramática não o reconhece ou falta termo no glossário.

    falhas: se for uma lista, recebe o termo ou a chave que impediu a tradução (relatório de cobertura).
    """
    tabela = ABREV_PT if abrevs is None else abrevs
    for regra in (_cabecalho, _citacao, _relacao):
        try:
            t = regra(p, glos, nomes, gram, tabela)
        except Falha as falha:
            if falhas is not None:
                falhas.append(str(falha))
            return None
        if t is not None:
            return _pos(t, gram)
    return None


def traduz_descricao(texto: str, glos: Mapping[str, Mapping[str, str]], nomes: Mapping[str, str],
                     gram: Mapping[str, str] = GRAMATICA_PT, abrevs: list[str] | None = None,
                     falhas: list[str] | None = None) -> str | None:
    """Descrição inteira na língua (parágrafos separados por '\\n\\n'), ou None se algum parágrafo falhar.

    nomes: nome inglês citado no texto -> nome da língua (da entity_name ligada à entidade e aos seus parentes).
    Tudo ou nada: uma descrição meio traduzida mistura línguas, então ela fica sem tradução.
    """
    if not texto or not texto.strip():
        return None
    saida = []
    for p in texto.split("\n\n"):
        p = p.strip()
        if not p:
            continue
        t = traduz_paragrafo(p, glos, nomes, gram, abrevs, falhas)
        if t is None:
            return None
        saida.append(t)
    return "\n\n".join(saida) if saida else None
