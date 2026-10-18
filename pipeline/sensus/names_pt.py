"""Nomes próprios em português, escolhidos na Bíblia Livre por alinhamento de versículos. Funções puras (sem I/O).

Ideia: um nome inglês (theographic, stepbible-tipnr, openbible-geo) aparece em certos versículos. Nesses
versículos, a Bíblia Livre traz o nome em português. O candidato é a palavra capitalizada do texto que
(a) se parece com o nome na grafia, (b) aparece em muitos dos versículos do nome e (c) é rara no corpus
inteiro (palavras comuns como Deus ou SENHOR perdem por especificidade). Sem IA e sem tradução automática.

Confiança (ver confianca): 'alta' por uma de duas vias:
  1. grafia parecida (semelhança >= 0.8), cobertura >= 0.5 e especificidade >= 0.3;
  2. nome com >= 5 versículos, cobertura >= 0.85 e especificidade >= 0.5, com grafia diferente mas
     semelhança >= 0.2 (James -> Tiago, John -> João, Peter -> Pedro).
'media' com semelhança >= 0.6; senão 'baixa'. Gentílicos e plurais em -ite/-ites são sempre 'baixa'
(a Bíblia Livre os escreve em minúscula, então o candidato não sai bom; ver docs do glossário futuro).

Compostos ('Mount Sinai', 'Valley of Elah', 'Gilboa_Mount'): decompoe() separa cabeça do glossário e núcleo;
escolhe_frase() só aceita a frase que aparece literalmente no texto da Bíblia Livre (cabeça pt + núcleo pt, ou
captura da palavra que segue a cabeça no próprio texto). Sem frase achada, a linha fica 'baixa' para revisão.

Rodar os testes a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import difflib
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass

LIMIAR_ALTA_SEMELHANCA = 0.8
LIMIAR_ALTA_COBERTURA = 0.5
LIMIAR_ALTA_ESPECIFICIDADE = 0.3
LIMIAR_MEDIA_SEMELHANCA = 0.6
# Segunda via para 'alta' (grafia diferente, nome que aparece em quase todos os seus versículos).
LIMIAR_VIA2_VERSOS = 5
LIMIAR_VIA2_COBERTURA = 0.85
LIMIAR_VIA2_ESPECIFICIDADE = 0.5
LIMIAR_VIA2_SEMELHANCA = 0.2

_PALAVRA = re.compile(r"[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ][\wÀ-ÿ]*(?:-[\wÀ-ÿ]+)*")
_PARENTESES = re.compile(r"\([^)]*\)")
_SUFIXO = re.compile(r"\s+(\d+)$")
_GENTILICO = re.compile(r"ites?$", re.IGNORECASE)

# Dígrafos e grafias inglesas trocadas para uma forma comum antes de comparar.
_TROCAS = [
    ("ph", "f"), ("th", "t"), ("ch", "c"), ("sh", "s"), ("qu", "c"), ("gu", "g"),
    ("k", "c"), ("x", "s"), ("z", "s"), ("y", "i"), ("w", "v"), ("j", "i"), ("h", ""),
]


def split_name(name: str) -> tuple[str, str] | None:
    """Separa o nome em (base, sufixo). 'Achzib 2' -> ('Achzib', ' 2'); 'Abel (son of Adam)' -> ('Abel', '').

    Parênteses são descartados (não entram no nome pt). None para nome que não é próprio de uma palavra só:
    com '_', começando em minúscula, ou composto com espaço ('Mount Sinai', 'Holy Spirit').
    """
    s = _PARENTESES.sub("", name).strip()
    suffix = ""
    m = _SUFIXO.search(s)
    if m:
        suffix = f" {m.group(1)}"
        s = s[: m.start()].rstrip()
    if not s or "_" in s or not s[0].isupper() or " " in s:
        return None
    return s, suffix


def base_name(name: str) -> str | None:
    """Nome-base sem sufixo numérico nem parênteses; None para nome não próprio ou composto."""
    parts = split_name(name)
    return parts[0] if parts else None


def gentilico(nome: str) -> bool:
    """Gentílico ou plural em -ite/-ites (Silonitas, Hacmonitas, Jebuseu...). Vai para revisão, não para 'alta'."""
    return _GENTILICO.search(nome) is not None


def _sem_acento(s: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(ch) != "Mn")


def skel(s: str) -> str:
    """Esqueleto fonético: minúsculas sem acento, dígrafos e grafias equivalentes trocados, letras repetidas
    colapsadas. 'Abihu' e 'Abiú' ficam iguais ('abiu')."""
    s = _sem_acento(s)
    for a, b in _TROCAS:
        s = s.replace(a, b)
    s = re.sub(r"(.)\1+", r"\1", s)
    return re.sub(r"[^a-z]", "", s)


def similarity(a: str, b: str) -> float:
    """Semelhança de grafia entre dois nomes, de 0 a 1, sobre o esqueleto fonético."""
    return difflib.SequenceMatcher(None, skel(a), skel(b)).ratio()


def candidates(verse_text: str) -> set[str]:
    """Palavras capitalizadas de um versículo (candidatos a nome próprio em português)."""
    return set(_PALAVRA.findall(verse_text))


def confianca(nome: str, semelhanca: float, cobertura: float, especificidade: float, versos: int) -> str:
    """'alta', 'media' ou 'baixa' pelos limiares do módulo (ver a docstring do módulo)."""
    if gentilico(nome):
        return "baixa"
    if (semelhanca >= LIMIAR_ALTA_SEMELHANCA and cobertura >= LIMIAR_ALTA_COBERTURA
            and especificidade >= LIMIAR_ALTA_ESPECIFICIDADE):
        return "alta"
    if (versos >= LIMIAR_VIA2_VERSOS and cobertura >= LIMIAR_VIA2_COBERTURA
            and especificidade >= LIMIAR_VIA2_ESPECIFICIDADE and semelhanca >= LIMIAR_VIA2_SEMELHANCA):
        return "alta"
    if semelhanca >= LIMIAR_MEDIA_SEMELHANCA:
        return "media"
    return "baixa"


@dataclass(frozen=True)
class Escolha:
    """Resultado de choose/avalia: candidato e os números que justificam a escolha."""
    nome: str | None          # candidato em português (None quando nenhum versículo do nome está na Bíblia Livre)
    alternativa: str | None   # segundo colocado, para revisão humana
    semelhanca: float
    cobertura: float          # k/n: fração dos versículos do nome em que o candidato aparece
    especificidade: float     # k/df: fração das ocorrências do candidato no corpus que caem nestes versículos
    confianca: str
    versos: int               # versículos do nome que existem na Bíblia Livre


def pontua(name: str, c: str, versos, verse_candidates: dict[int, set[str]], df: Counter) -> tuple[float, float, float, int]:
    """(semelhança, cobertura, especificidade, versos) de um candidato fixo nos versículos do nome."""
    V = [v for v in versos if v in verse_candidates]
    if not V:
        return 0.0, 0.0, 0.0, 0
    k = sum(1 for v in V if c in verse_candidates[v])
    spec = k / df[c] if k else 0.0
    return similarity(name, c), k / len(V), spec, len(V)


def avalia(name: str, c: str, versos, verse_candidates: dict[int, set[str]], df: Counter,
           alternativa: str | None = None) -> Escolha:
    """Números e confiança de um candidato já escolhido (usado por entidade agrupada pelo candidato)."""
    s, cov, spec, n = pontua(name, c, versos, verse_candidates, df)
    # Arredondado antes da confiança: o que aparece na revisão é o que decidiu o nível.
    s, cov, spec = round(s, 2), round(cov, 2), round(spec, 2)
    return Escolha(c, alternativa, s, cov, spec, confianca(name, s, cov, spec, n), n)


def choose(name: str, verse_ids, verse_candidates: dict[int, set[str]], df: Counter) -> Escolha:
    """Escolhe o nome pt de `name` entre os candidatos dos seus versículos.

    verse_ids: versículos (vid) em que o nome aparece; verse_candidates: vid -> candidatos do texto;
    df: em quantos versículos do corpus cada candidato aparece. Pontuação:
    semelhança^2 * (0.5 + 0.5*cobertura) * (0.3 + 0.7*especificidade^0.3). Empate: ordem alfabética.
    """
    V = [v for v in verse_ids if v in verse_candidates]
    if not V:
        return Escolha(None, None, 0.0, 0.0, 0.0, "baixa", 0)
    k = Counter(c for v in V for c in verse_candidates[v])
    ranking = []
    for c, kc in k.items():
        s = similarity(name, c)
        cov = kc / len(V)
        spec = kc / df[c]
        score = s * s * (0.5 + 0.5 * cov) * (0.3 + 0.7 * spec ** 0.3)
        ranking.append((-score, c))
    ranking.sort()
    melhor = ranking[0][1]
    alternativa = ranking[1][1] if len(ranking) > 1 else None
    return avalia(name, melhor, V, verse_candidates, df, alternativa)


# Compostos (ver decompoe e escolhe_frase). Nome composto próprio = cabeça do glossário + núcleo de uma palavra.
_ARTIGO_INICIAL = re.compile(r"^the\s+", re.IGNORECASE)
_POSSESSIVO = re.compile(r"'s$")
# Palavras que, mesmo capitalizadas no texto, não são o núcleo de um nome ('porta do SENHOR' não é nome).
_NAO_NUCLEO_NO_TEXTO = {"Deus", "Senhor", "Jesus", "Cristo", "Espírito"}
_LIMITE_PALAVRA = r"(?<!\w)"
# Núcleo que veio só da captura (sem nome pt próprio) só vira 'alta' com grafia parecida ao inglês. Frase específica
# de grafia diferente (Red Sea -> mar Vermelho) fica 'media' para revisão: 'Guard Gate' pegou 'porta Velha' de uma
# lista de portas no mesmo versículo, e a especificidade não distingue isso.
LIMIAR_NUCLEO_CAPTURA = 0.5


@dataclass(frozen=True)
class Composto:
    """Composto decomposto: base (chave do TSV, sem sufixo e com espaço no lugar de '_'), sufixo numérico,
    cabeça do glossário ('Mount', 'Valley of') e núcleo em inglês ('Sinai', 'Elah')."""
    base: str
    sufixo: str
    cabeca: str
    nucleo: str


def _limpa_composto(name: str) -> tuple[str, str]:
    """(base, sufixo) de um nome composto: parênteses fora, '_' e aspas tipográficas normalizados."""
    s = _PARENTESES.sub("", name).strip()
    sufixo = ""
    m = _SUFIXO.search(s)
    if m:
        sufixo = f" {m.group(1)}"
        s = s[: m.start()].rstrip()
    s = s.replace("_", " ").replace("’", "'")
    return " ".join(s.split()), sufixo


def decompoe(name: str, glossario: dict[str, tuple[str, ...]]) -> Composto | None:
    """Cabeça e núcleo de um nome composto próprio; None para descritivo ('Wife of Simon') ou cabeça fora do glossário.

    Padrões, nesta ordem: 'Cabeça of Núcleo' (Mount of Olives), 'Núcleo Cabeça' (Fish Gate, Gilboa_Mount) e
    'Cabeça Núcleo' (Mount Sinai). O núcleo tem de ser uma palavra só, sem 'of' dentro, sem artigo inicial e
    sem possessivo: 'the Philistines' vira 'Philistines' e "Benjamin's" vira 'Benjamin'.
    """
    base, sufixo = _limpa_composto(name)
    palavras = base.split(" ")
    if len(palavras) < 2:
        return None
    if "of" in palavras:
        i = palavras.index("of")
        cabeca, resto = " ".join(palavras[: i + 1]), " ".join(palavras[i + 1:])
    elif palavras[-1] in glossario:
        cabeca, resto = palavras[-1], " ".join(palavras[:-1])
    elif palavras[0] in glossario:
        cabeca, resto = palavras[0], " ".join(palavras[1:])
    else:
        return None
    if cabeca not in glossario:
        return None
    nucleo = _POSSESSIVO.sub("", _ARTIGO_INICIAL.sub("", resto))
    if " " in nucleo or not nucleo[:1].isupper():
        return None
    return Composto(base, sufixo, cabeca, nucleo)


def frases(formas: tuple[str, ...], nucleo_pt: str) -> list[str]:
    """Frases candidatas: cada forma do glossário seguida do núcleo em português ('monte das' + 'Oliveiras')."""
    return [f"{f} {nucleo_pt}" for f in formas]


def _rx_frase(frase: str) -> re.Pattern:
    # Sem diferença de maiúsculas; acentos têm de ser iguais; a frase não pode estar dentro de uma palavra maior.
    return re.compile(_LIMITE_PALAVRA + re.escape(frase) + r"(?!\w)", re.IGNORECASE)


def _rx_captura(forma: str) -> re.Pattern:
    # A forma do glossário (sem diferença de maiúsculas) seguida de uma palavra capitalizada do próprio texto.
    return re.compile(_LIMITE_PALAVRA + "((?i:" + re.escape(forma) + ")) ([A-ZÀ-Ý][\\wÀ-ÿ'-]*)(?!\\w)")


def _captura_valida(palavra: str) -> bool:
    return len(palavra) >= 3 and not palavra.isupper() and palavra not in _NAO_NUCLEO_NO_TEXTO



def ocorrencias(texto: str, formas: tuple[str, ...], nucleo_pt: str | None) -> list[tuple[str, str | None]]:
    """Trechos do texto que são frases candidatas: (trecho como escrito, palavra capturada ou None).

    Duas vias: as frases com o núcleo pt (palavra None, o núcleo já tem nome pt) e as capturas (forma + palavra
    capitalizada do texto), que cobrem núcleos sem nome pt próprio ('Fish' -> 'dos Peixes').
    """
    achadas: list[tuple[str, str | None]] = []
    if nucleo_pt:
        for fr in frases(formas, nucleo_pt):
            m = _rx_frase(fr).search(texto)
            if m:
                achadas.append((m.group(0), None))
    for forma in formas:
        for m in _rx_captura(forma).finditer(texto):
            if _captura_valida(m.group(2)):
                achadas.append((m.group(0), m.group(2)))
    return achadas


@dataclass(frozen=True)
class Frase:
    """Resultado de escolhe_frase: a frase achada (como está no texto) e a confiança pela cobertura."""
    candidato: str            # frase do texto (a mais comum); se não achada, forma do glossário + núcleo
    alternativa: str | None   # segunda frase achada, para revisão humana
    achados: int              # versículos do nome em que a frase aparece
    versos: int               # versículos do nome que existem na Bíblia Livre
    confianca: str            # 'alta' (>= 50% dos versículos), 'media' (achada em menos), 'baixa' (não achada)


def escolhe_frase(formas: tuple[str, ...], nucleo_en: str, nucleo_pt: str | None, versos, textos: dict[int, str]) -> Frase:
    """Escolhe a frase pt de um composto pelos versículos dele. Só aceita frase literal no texto da Bíblia Livre.

    Ranking: mais versículos; empate, frase com núcleo pt (peso 1), depois a palavra capturada mais parecida com o
    núcleo inglês, depois ordem do glossário e alfabética. Alta quando a frase aparece em pelo menos metade dos
    versículos (com 1 ou 2 versículos, basta 1) E o núcleo tem nome pt ou grafia parecida ao inglês (ver
    LIMIAR_NUCLEO_CAPTURA). Achada mas sem isso: 'media'.
    """
    V = [v for v in versos if v in textos]
    n = len(V)
    por_frase: dict[str, set[int]] = defaultdict(set)
    trechos: dict[str, Counter] = defaultdict(Counter)
    ordem: dict[str, int] = {}
    mapeada: set[str] = set()
    semelhanca: dict[str, float] = defaultdict(float)
    if nucleo_pt:
        for i, fr in enumerate(frases(formas, nucleo_pt)):
            ordem.setdefault(fr.lower(), i)
    for v in V:
        for trecho, palavra in ocorrencias(textos[v], formas, nucleo_pt):
            chave = trecho.lower()
            por_frase[chave].add(v)
            trechos[chave][trecho] += 1
            if palavra is None:
                mapeada.add(chave)
            else:
                semelhanca[chave] = max(semelhanca[chave], similarity(nucleo_en, palavra))

    def peso(c: str) -> float:
        return 1.0 if c in mapeada else semelhanca[c]

    ranking = sorted(por_frase, key=lambda c: (-len(por_frase[c]), -peso(c), ordem.get(c, len(ordem)), c))
    if not ranking:
        nao_achada = frases(formas, nucleo_pt)[0] if nucleo_pt else f"{formas[0]} {nucleo_en}"
        return Frase(nao_achada, None, 0, n, "baixa")
    melhor = ranking[0]
    k = len(por_frase[melhor])
    alternativa = trechos[ranking[1]].most_common(1)[0][0] if len(ranking) > 1 else None
    confiavel = melhor in mapeada or peso(melhor) >= LIMIAR_NUCLEO_CAPTURA
    confianca = "alta" if k * 2 >= n and confiavel else "media"
    return Frase(trechos[melhor].most_common(1)[0][0], alternativa, k, n, confianca)
