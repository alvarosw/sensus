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

Rodar os testes a partir da raiz do repositório: cd pipeline && python3 -m unittest discover tests
"""

import difflib
import re
import unicodedata
from collections import Counter
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
