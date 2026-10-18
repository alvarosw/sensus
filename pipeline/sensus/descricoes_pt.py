"""Descrições em português das entidades (entity_text), traduzidas por regra. Funções puras (sem I/O).

Serve à fonte sensus-descricoes-pt. Só o stepbible-tipnr entra aqui: as descrições dele seguem um modelo fixo
(cabeçalho 'A man from the tribe of X living at the time of Y, first mentioned at Gen.1.1)', linhas 'son of X;',
'only referred to as X (HEB);'). Cada parágrafo é reconhecido por uma gramática pequena; um parágrafo que ela
não reconhece, ou um vocabulário fora do glossário (corrections/glossario-descricoes.tsv), faz a descrição inteira
ficar sem tradução. O app então mostra a tradução automática, como para qualquer descrição sem entity_text.

Nomes próprios: o nome pt de cada entidade citada vem de entity_name (cite_id ligado na fonte; ver
ingest/descricoes_pt.py). Nome sem pt fica em inglês, sem falhar a tradução. Referências 'Exo.4.14' viram
'Êx 4:14' com as abreviações pt do app (packages/core/src/ai/cite-index.ts, BOOK_ABBREVIATIONS).

Regra nova = função pura com teste, com caso de AT hebraico e de NT grego (ver pipeline/tests/test_descricoes_pt.py).
"""

import re
from collections.abc import Mapping

from sensus import refs

# Abreviações pt-BR dos livros por OSIS: espelha BOOK_ABBREVIATIONS de packages/core/src/ai/cite-index.ts.
ABREVIATURA = {
    "Gen": "Gn", "Exod": "Êx", "Lev": "Lv", "Num": "Nm", "Deut": "Dt", "Josh": "Js", "Judg": "Jz", "Ruth": "Rt",
    "1Sam": "1Sm", "2Sam": "2Sm", "1Kgs": "1Rs", "2Kgs": "2Rs", "1Chr": "1Cr", "2Chr": "2Cr",
    "Ezra": "Ed", "Neh": "Ne", "Esth": "Et", "Job": "Jó", "Ps": "Sl", "Prov": "Pv", "Eccl": "Ec", "Song": "Ct",
    "Isa": "Is", "Jer": "Jr", "Lam": "Lm", "Ezek": "Ez", "Dan": "Dn", "Hos": "Os", "Joel": "Jl", "Amos": "Am",
    "Obad": "Ob", "Jonah": "Jn", "Mic": "Mq", "Nah": "Na", "Hab": "Hc", "Zeph": "Sf", "Hag": "Ag", "Zech": "Zc",
    "Mal": "Ml", "Matt": "Mt", "Mark": "Mc", "Luke": "Lc", "John": "Jo", "Acts": "At", "Rom": "Rm", "1Cor": "1Co",
    "2Cor": "2Co", "Gal": "Gl", "Eph": "Ef", "Phil": "Fp", "Col": "Cl", "1Thess": "1Ts", "2Thess": "2Ts",
    "1Tim": "1Tm", "2Tim": "2Tm", "Titus": "Tt", "Phlm": "Fm", "Heb": "Hb", "Jas": "Tg", "1Pet": "1Pe",
    "2Pet": "2Pe", "1John": "1Jo", "2John": "2Jo", "3John": "3Jo", "Jude": "Jd", "Rev": "Ap",
}

# Seções do glossário (corrections/glossario-descricoes.tsv). Cada uma é um mapa inglês -> português.
SECOES = ("cargo", "tempo", "tribo", "lugar", "relacao", "nome")

_REF = re.compile(r"(?P<livro>(?:LXX\.)?[1-3]?[A-Za-z]+)\.(?P<cap>\d+)\.(?P<ver>\d+)(?P<suf>[a-z]?)")
_REF_NA_FRASE = re.compile(r"\s(?:first|only) mentioned at (\S+)\)$")
_LISTA = re.compile(r", and | and |, or | or |, ")


def ler_glossario(texto: str) -> dict[str, dict[str, str]]:
    """Glossário do TSV (secao, ingles, portugues, nota). Erro com o número da linha para seção fora de SECOES,
    termo vazio ou repetido na mesma seção: o pipeline não traduz com um glossário ambíguo."""
    out: dict[str, dict[str, str]] = {s: {} for s in SECOES}
    for n, linha in enumerate(texto.splitlines(), 1):
        if not linha.strip() or linha.startswith("#") or linha.startswith("secao\t"):
            continue
        campos = (linha.split("\t") + ["", "", "", ""])[:4]
        secao, ingles, portugues = campos[0], campos[1], campos[2]
        if secao not in SECOES:
            raise ValueError(f"glossário, linha {n}: seção inválida {secao!r} (use {', '.join(SECOES)})")
        if not ingles or not portugues:
            raise ValueError(f"glossário, linha {n}: termo ou tradução vazio")
        if ingles in out[secao]:
            raise ValueError(f"glossário, linha {n}: termo repetido em {secao}: {ingles!r}")
        out[secao][ingles] = portugues
    return out


def ref_pt(ref: str) -> str | None:
    """'Exo.4.14' -> 'Êx 4:14'; 'Psa.120.5' -> 'Sl 120:5'. None para o que não é um versículo só."""
    m = _REF.fullmatch(ref)
    if not m:
        return None
    try:
        osis = refs.BOOK_BY_NUM[refs.book_num(m.group("livro"))][1]
    except KeyError:
        return None
    abreviatura = ABREVIATURA.get(osis)
    if abreviatura is None:
        return None
    return f"{abreviatura} {int(m.group('cap'))}:{int(m.group('ver'))}{m.group('suf')}"


class _Falha(Exception):
    """A descrição tem trecho fora da gramática ou do glossário: o parágrafo (e a descrição) não é traduzido."""


# Nome próprio: palavras com maiúscula inicial, ligadas por espaço ('Ben-hadad III', 'Abel-meholah'). 'the Kingdom of
# Israel' não é nome; sem pt, um nome fica em inglês, mas uma expressão comum não passa.
_EH_NOME = re.compile(r"[A-Z][^\s]*(?: [A-Z][^\s]*)*(?:\(\?\))?")


def _nome(x: str, nomes: Mapping[str, str], glossario: Mapping[str, Mapping[str, str]]) -> str:
    """Nome pt de um nome inglês citado no texto: entity_name ligado (nomes), depois o glossário de termos
    de nomes (seção nome), senão o próprio inglês. '(?)' de dúvida da fonte é mantido."""
    if not _EH_NOME.fullmatch(x) or x.startswith("The "):  # 'The Stone Pavement' é título, não nome
        raise _Falha(x)
    base, duvida = (x[:-3], "(?)") if x.endswith("(?)") else (x, "")
    return (nomes.get(base) or glossario["nome"].get(base) or base) + duvida


def _lista(texto: str) -> list[str]:
    return [p.strip() for p in _LISTA.split(texto) if p.strip()]


def _junta(itens: list[str], conector: str) -> str:
    """['A', 'B', 'C'], 'e' -> 'A, B e C'."""
    if len(itens) <= 1:
        return "".join(itens)
    return ", ".join(itens[:-1]) + f" {conector} " + itens[-1]


def _cabecalho(p: str, glos, nomes) -> str | None:
    """'A man from the tribe of Asher living at the time of Divided Monarchy, first mentioned at 1Ch.7.34)'
    -> 'Homem da tribo de Aser, da época da monarquia dividida; primeira menção em 1Cr 7:34.'"""
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
    ref = ref_pt(mm.group(1))
    if ref is None:
        return None
    mencao = ("primeira menção em " if "first mentioned" in corpo else "só aparece em ") + ref
    resto = corpo[: mm.start()].rstrip(", ")
    tempo = None
    mt = re.search(r"(?:^|\s)living (.+)$", resto)
    if mt:
        tempo = glos["tempo"].get(mt.group(1))
        if tempo is None:
            return None
        resto = resto[: mt.start()].rstrip(", ")
    # Cargo: a maior chave do glossário que abre a frase (com fronteira de palavra).
    cargo_pt = None
    for chave in sorted(glos["cargo"], key=len, reverse=True):
        if resto == chave or resto.startswith(chave + " "):
            cargo_pt = glos["cargo"][chave]
            resto = resto[len(chave):].strip()
            break
    if cargo_pt is None:
        return None
    complemento = _complemento(resto, glos, nomes)
    frase = cargo_pt + (" " + complemento if complemento else "")
    if tempo:  # vírgula só quando já há complemento ('Sumo sacerdote da tribo de Levi, da época do Egito')
        frase += (", " if complemento else " ") + tempo
    return frase[:1].upper() + frase[1:] + "; " + mencao + "."


def _complemento(resto: str, glos, nomes) -> str | None:
    """Complemento do cargo: 'from the tribe of Levi', 'near Abdon', 'of the city Admah', 'in Asia'."""
    if not resto:
        return ""
    if resto in glos["lugar"]:
        return glos["lugar"][resto]
    m = re.fullmatch(r"in (.+) Tribe(?: near (.+))?", resto)  # 'in Judah Tribe near Tekoa'
    if m:
        perto = f", perto de {_nome(m.group(2), nomes, glos)}" if m.group(2) else ""
        return "no território da tribo de " + _tribo(m.group(1), glos) + perto
    m = re.fullmatch(r"from the tribe of (.+)", resto)
    if m:
        return "da tribo de " + _tribo(m.group(1), glos)
    m = re.fullmatch(r"of the city (.+)", resto)
    if m:
        return "da cidade de " + _nome(m.group(1), nomes, glos)
    m = re.fullmatch(r"near (.+)", resto)
    if m:
        return "perto de " + _nome(m.group(1), nomes, glos)
    m = re.fullmatch(r"(?:from|of) (.+)", resto)
    if m:
        return "de " + _nome(m.group(1), nomes, glos)
    m = re.fullmatch(r"in (.+)", resto)
    if m:
        return "em " + _nome(m.group(1), nomes, glos)
    raise _Falha(resto)


def _tribo(x: str, glos) -> str:
    """Nome de tribo (glossário, seção tribo); '(?)' de dúvida da fonte é mantido."""
    base, duvida = (x[:-3], "(?)") if x.endswith("(?)") else (x, "")
    if base not in glos["tribo"]:
        raise _Falha(x)
    return glos["tribo"][base] + duvida


def _citacao(p: str, glos, nomes) -> str | None:
    """'only referred to as Abijah (אֲבִיָּה);' -> 'Chamado apenas de Abias (אֲבִיָּה);'."""
    m = re.fullmatch(r"(only )?referred to as (.+?)([;.])", p)
    if not m:
        return None
    itens = []
    for parte in re.split(r", or | or ", m.group(2)):
        mm = re.fullmatch(r"(.+?)(?: \(([^()]*)\))?", parte.strip())
        if not mm:
            return None
        nome = _nome(mm.group(1), nomes, glos)
        itens.append(nome + (f" ({mm.group(2)})" if mm.group(2) is not None else ""))
    return ("Chamado apenas de " if m.group(1) else "Chamado de ") + _junta(itens, "ou") + m.group(3)


def _relacao(p: str, glos, nomes) -> str | None:
    """'a son of Gera;' -> 'filho de Gera;'; 'a brother of Joash, Joram and Athaliah.' -> 'irmão de Joás, ...'."""
    m = re.fullmatch(r"(?:an? )?([a-z][a-z\- ]*? of):? (.+?)([;.])", p)
    if not m:
        return None
    relacao = glos["relacao"].get(m.group(1))
    if relacao is None:
        return None
    itens = [_nome(x, nomes, glos) for x in _lista(m.group(2))]
    if not itens:
        return None
    conector = "ou" if " or " in m.group(2) else "e"
    return f"{relacao} {_junta(itens, conector)}{m.group(3)}"


def traduz_paragrafo(p: str, glos: Mapping[str, Mapping[str, str]], nomes: Mapping[str, str]) -> str | None:
    """Um parágrafo da descrição; None se a gramática não o reconhece ou falta termo no glossário."""
    for regra in (_cabecalho, _citacao, _relacao):
        try:
            t = regra(p, glos, nomes)
        except _Falha:
            return None
        if t is not None:
            return t
    return None


def traduz_descricao(texto: str, glos: Mapping[str, Mapping[str, str]], nomes: Mapping[str, str]) -> str | None:
    """Descrição inteira em pt (parágrafos separados por '\\n\\n'), ou None se algum parágrafo falhar.

    nomes: nome inglês citado no texto -> nome pt (da entity_name ligada à entidade e aos seus parentes).
    Tudo ou nada: uma descrição meio traduzida mistura línguas, então ela fica sem tradução.
    """
    if not texto or not texto.strip():
        return None
    saida = []
    for p in texto.split("\n\n"):
        p = p.strip()
        if not p:
            continue
        t = traduz_paragrafo(p, glos, nomes)
        if t is None:
            return None
        saida.append(t)
    return "\n\n".join(saida) if saida else None
