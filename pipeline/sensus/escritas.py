"""Perfis de escrita: como cada língua acha nomes próprios na Bíblia da língua e os compara com o nome inglês.

Um perfil diz: (a) quais palavras do texto são candidatas a nome; (b) como a grafia vira alfabeto latino para comparar
com o inglês (romaniza); (c) como a saída fica (saida: NFC, tira tashkil e a marca ؔ do urdu); (d) como agrupar
flexões (chave: genitivo -s do alemão, casos do russo); (e) como pontuar; (f) que palavras não são núcleo de composto.

pt é o perfil de origem: seus valores reproduzem exatamente o que sensus/names_pt.py fazia antes desta divisão
(test_escritas.py guarda a regressão). Funções puras, só biblioteca padrão.

Bíblia de cada língua: BIBLIA_NOMES em pipeline/sensus/linguas.py. zh usa os nomes marcados (\\pn) do sidecar
proper_names.jsonl de cmncbs; ur usa as palavras marcadas com ؔ no próprio texto de urdoucv; ja compara sequências
katakana com o nome inglês por tabela kana -> romaji; os demais comparam palavras capitalizadas (ou palavras, no
caso de árabe, hindi e bengali) por romanização aproximada.
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Callable

from sensus.linguas import LINGUAS


@dataclass(frozen=True)
class Limiares:
    """Limites de confiança: via 1 (grafia parecida) e via 2 (nome em quase todos os seus versículos)."""
    alta_sem: float
    alta_cob: float
    alta_esp: float
    media_sem: float
    via2_versos: int
    via2_cob: float
    via2_esp: float
    via2_sem: float


LIMIARES_PT = Limiares(0.8, 0.5, 0.3, 0.6, 5, 0.85, 0.5, 0.2)
# zh: a grafia chinesa não se compara com o inglês, então a via 1 é impossível e 'media' é o padrão para o resto.
LIMIARES_ZH = Limiares(2.0, 0.5, 0.3, 0.0, 3, 0.8, 0.5, 0.0)


@dataclass(frozen=True)
class Perfil:
    lang: str
    candidatos: Callable[[str], set[str]]    # texto do versículo -> palavras candidatas (já com saida)
    romaniza: Callable[[str], str]           # palavra -> forma latina aproximada, para similaridade com o inglês
    saida: Callable[[str], str]              # forma que vai para o TSV e para o banco
    chave: Callable[[str, frozenset[str]], str]  # agrupa flexões; recebe o vocabulário do corpus
    pontuacao: Callable[[float, float, float], float]  # (semelhança, cobertura, especificidade)
    nao_nucleo: frozenset[str]               # palavras que, no texto, não são o núcleo de um composto
    limites_de_palavra: bool = True          # regex com (?<!\w) e (?!\w)? (zh e ja escrevem sem espaço)
    captura: bool = True                     # captura forma do glossário + palavra capitalizada do texto
    min_captura: int = 3
    usa_marcados: bool = False               # candidatos vêm dos nomes marcados na Bíblia (\pn, ؔ)
    limiares: Limiares = LIMIARES_PT
    maiuscula: str = "[^\\W\\d_]"            # primeira letra de uma palavra capitalizada (regex)
    # ar: palavras do corpus (para validar formas sem proclítico) e sequências de 2-3 palavras (nomes com hífen).
    palavras: Callable[[str], set[str]] | None = None
    sequencias: Callable[[str], set[str]] | None = None


# ---- candidatos ---------------------------------------------------------------------------------------------------

_PALAVRA_PT = re.compile(r"[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ][\wÀ-ÿ]*(?:-[\wÀ-ÿ]+)*")
_PALAVRA_LATINA = re.compile(r"[^\W\d_]\w*(?:-\w+)*")
_PALAVRA_RU = re.compile(r"[А-ЯЁ][А-Яа-яЁё-]*")
_TOKEN_AR = re.compile(r"[ؐ-ؚء-ؿـ-ٰٟ-ۓە-ۭ]+")
_TOKEN_HI = re.compile(r"[ऀ-ॣ॰-ॿ]+")
# sem ৲-৻ (moeda, frações, ৷ usado como danda na benirv, isshar)
_TOKEN_BN = re.compile(r"[ঀ-ৣৰৱৼ৾]+")
_KATAKANA = re.compile(r"[ァ-ヺー・]{2,}")


def _cand_pt(texto: str) -> set[str]:
    return set(_PALAVRA_PT.findall(texto))


def _cand_latina(texto: str) -> set[str]:
    # Com maiúscula inicial; a apóstrofe separa "d'Abraham" em "d" (minúscula, fora) e "Abraham".
    return {p for p in _PALAVRA_LATINA.findall(texto) if p[:1].isupper()}


def _cand_ru(texto: str) -> set[str]:
    return set(_PALAVRA_RU.findall(texto))


def _palavras_ar(texto: str) -> set[str]:
    # Palavras do texto (saida), para o corpus: dizem se uma forma sem proclítico aparece sozinha.
    return {t for t in (_saida_ar(x) for x in _TOKEN_AR.findall(texto)) if len(t) >= 2}


def _cand_ar(texto: str, atestadas: frozenset[str] = frozenset()) -> set[str]:
    # Árabe não tem maiúscula. Sempre: a palavra inteira e a forma sem o و de conjunção (وبراخة -> براخة, Matthan
    # ومتان -> متان). Sem as outras letras (ف ب ل ك e as duplas وب وك ول وف) a forma só entra se ela própria
    # aparece sem proclítico no corpus (atestadas): فروايم (Parvaim) e فارص (Perez) ficam com a letra.
    out: set[str] = set()
    for t in _palavras_ar(texto):
        out.add(t)
        if len(t) >= 3 and t[0] == "و":
            out.add(t[1:])
        candidatas = []
        if len(t) >= 3 and t[0] in "فبلك":
            candidatas.append(t[1:])
        if len(t) >= 4 and t[0] == "و" and t[1] in "فبلك":
            candidatas.append(t[2:])
        out.update(c for c in candidatas if len(c) >= 2 and c in atestadas)
    return out


# Preposições e partículas: não começam nem terminam um nome composto ('em Ezion-geber' não é 'Ezion-geber').
_PARTICULAS_AR = frozenset({"في", "من", "على", "الى", "إلى", "عن", "مع", "عند", "ان", "أن", "ما", "لا"})


def _sequencias_ar(texto: str) -> set[str]:
    # Nomes com hífen em inglês são duas ou mais palavras em árabe (Beth-horon -> بيت حورون). Pares e trios de
    # palavras seguidas do texto, sem o و de conjunção em cada palavra. Só é usado para nomes com hífen (ingest/nomes.py).
    palavras = [p[1:] if len(p) >= 3 and p[0] == "و" else p for p in (_saida_ar(t) for t in _TOKEN_AR.findall(texto))]
    out: set[str] = set()
    for n in (2, 3):
        for i in range(len(palavras) - n + 1):
            trecho = palavras[i:i + n]
            if all(len(p) >= 2 for p in trecho) and trecho[0] not in _PARTICULAS_AR and trecho[-1] not in _PARTICULAS_AR:
                out.add(" ".join(trecho))
    return out


def _cand_hi(texto: str) -> set[str]:
    return {t for t in _TOKEN_HI.findall(texto) if len(t) >= 2}


_SUFIXOS_BN = ("দের", "েরা", "ের", "এর", "কে", "র")


def _cand_bn(texto: str) -> set[str]:
    out: set[str] = set()
    for t in _TOKEN_BN.findall(texto):
        if len(t) < 2:
            continue
        out.add(t)
        # sem sufixo de caso (মোশির -> মোশি), desde que sobrem pelo menos 2 letras
        for s in _SUFIXOS_BN:
            if t.endswith(s) and len(t) - len(s) >= 2:
                out.add(t[: -len(s)])
                break
    return out


def _cand_ja(texto: str) -> set[str]:
    return {m for m in _KATAKANA.findall(texto) if len(m.replace("・", "")) >= 2}


def _cand_nenhum(texto: str) -> set[str]:
    # zh usa os nomes marcados em sidecar (\pn, usa_marcados); o texto não entra.
    return set()


def _cand_ur(texto: str) -> set[str]:
    # urdoucv marca o nome com ؔ (U+0614) dentro do próprio texto: só essas palavras são candidatas.
    return {_saida_ur(t) for t in _TOKEN_AR.findall(texto) if "ؔ" in t}


# ---- saída (forma do TSV e do banco) ----------------------------------------------------------------------------

_TASHKIL_AR = re.compile("[ً-ٰٟؔـ]")


def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def _saida_ar(s: str) -> str:
    # tira tashkil, marca do urdu (ؔ) e tatweel; alef de wasla (ٱ) vira alef (ا)
    return _nfc(_TASHKIL_AR.sub("", s).replace("ٱ", "ا"))


def _saida_ur(s: str) -> str:
    return _nfc(_TASHKIL_AR.sub("", s))


# ---- romanização (só para comparar grafia com o inglês) -----------------------------------------------------------

def _identidade(s: str) -> str:
    return s


_RU = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "zh", "з": "z", "и": "i",
    "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e",
    "ю": "yu", "я": "ya",
}
_AR = {
    "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ٱ": "a", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
    "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "",
    "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y", "ى": "a",
    "ة": "a", "ء": "", "ؤ": "w", "ئ": "y", "ـ": "", "ٰ": "a", "َ": "a", "ُ": "u", "ِ": "i", "ً": "", "ٌ": "", "ٍ": "",
    "ّ": "", "ْ": "", "ؔ": "",
    # urdu
    "ٹ": "t", "ڈ": "d", "ڑ": "r", "ں": "n", "ے": "e", "ہ": "h", "ھ": "h", "ی": "i", "ۃ": "a", "گ": "g", "چ": "ch",
    "پ": "p", "ژ": "zh", "ک": "k", "ۓ": "e", "ۂ": "h",
}
_DEV_CONS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
    "ष": "sh", "स": "s", "ह": "h",
}
_DEV_VOG = {"अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au"}
_DEV_MATRA = {"ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "ai", "ो": "o", "ौ": "au"}
_BN_CONS = {
    "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "n", "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "n",
    "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n", "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
    "প": "p", "ফ": "ph", "ব": "b", "ভ": "bh", "ম": "m", "য": "j", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh",
    "স": "s", "হ": "h", "ড়": "r", "ঢ়": "rh", "য়": "y",
}
_BN_VOG = {"অ": "o", "আ": "a", "ই": "i", "ঈ": "i", "উ": "u", "ঊ": "u", "এ": "e", "ঐ": "oi", "ও": "o", "ঔ": "ou"}
_BN_MATRA = {"া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou"}
_KANA = {}
for _linha, _vogais in (
    ("ア イ ウ エ オ", "a i u e o"), ("カ キ ク ケ コ", "ka ki ku ke ko"), ("サ シ ス セ ソ", "sa shi su se so"),
    ("タ チ ツ テ ト", "ta chi tsu te to"), ("ナ ニ ヌ ネ ノ", "na ni nu ne no"), ("ハ ヒ フ ヘ ホ", "ha hi fu he ho"),
    ("マ ミ ム メ モ", "ma mi mu me mo"), ("ヤ ユ ヨ", "ya yu yo"), ("ラ リ ル レ ロ", "ra ri ru re ro"),
    ("ワ ヲ ン", "wa o n"), ("ガ ギ グ ゲ ゴ", "ga gi gu ge go"), ("ザ ジ ズ ゼ ゾ", "za ji zu ze zo"),
    ("ダ ヂ ヅ デ ド", "da ji zu de do"), ("バ ビ ブ ベ ボ", "ba bi bu be bo"), ("パ ピ プ ペ ポ", "pa pi pu pe po"),
    ("ヴ", "vu"),
):
    for _k, _r in zip(_linha.split(), _vogais.split()):
        _KANA[_k] = _r
_KANA_PEQUENO = {"ャ": "ya", "ュ": "yu", "ョ": "yo", "ァ": "a", "ィ": "i", "ゥ": "u", "ェ": "e", "ォ": "o"}
_VOGAIS = "aeiou"


def _indica(texto: str, cons: dict, vog: dict, matra: dict, inerente: str, virama: str, extra: dict) -> str:
    """Romaniza escrita indiana: consoante + vogal inerente, salvo com matra (vogal) ou virama (sem vogal)."""
    texto = texto.replace("़", "")  # nukta
    out: list[str] = []
    i = 0
    while i < len(texto):
        ch = texto[i]
        if ch in cons:
            out.append(cons[ch])
            nxt = texto[i + 1] if i + 1 < len(texto) else ""
            if nxt in matra:
                out.append(matra[nxt])
                i += 2
                continue
            if nxt == virama:
                i += 2
                continue
            out.append(inerente)
        elif ch in vog:
            out.append(vog[ch])
        elif ch in extra:
            out.append(extra[ch])
        i += 1
    return "".join(out)


def _rom_hi(s: str) -> str:
    return _indica(s, _DEV_CONS, _DEV_VOG, _DEV_MATRA, "a", "्", {"ं": "n", "ँ": "n", "ः": "h"})


def _rom_bn(s: str) -> str:
    return _indica(s, _BN_CONS, _BN_VOG, _BN_MATRA, "o", "্", {"ং": "n", "ঃ": "h"})


def _rom_ru(s: str) -> str:
    return "".join(_RU.get(c, c) for c in s.lower())


def _rom_ar(s: str) -> str:
    return "".join(_AR.get(c, c) for c in s)


def _rom_ja(s: str) -> str:
    out: list[str] = []
    for c in s.replace("・", ""):
        if c in _KANA:
            out.append(_KANA[c])
        elif c in _KANA_PEQUENO:
            out.append(_KANA_PEQUENO[c])
        elif c == "ッ":
            continue
        elif c == "ー":
            # alongamento: repete a última vogal
            vogal = next((x for x in reversed("".join(out)) if x in _VOGAIS), "")
            out.append(vogal)
    return "".join(out)


def _rom_vi(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D").replace("-", "")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


# ---- chave (agrupa flexões) -------------------------------------------------------------------------------------

def _chave_identidade(texto: str, vocabulario: frozenset[str]) -> str:
    return texto


def _chave_de(texto: str, vocabulario: frozenset[str]) -> str:
    # genitivo -s (Abrahams -> Abraham) só quando a forma sem -s existe no corpus
    if texto.endswith("s") and texto[:-1] in vocabulario:
        return texto[:-1]
    return texto


# Desinências do russo, a mais longa primeiro. Só sai se sobrarem pelo menos 2 letras.
_DESINENCIAS_RU = sorted(
    ("ами", "ями", "ого", "ему", "ой", "ей", "ом", "ем", "ою", "ею", "ах", "ях", "ам", "ям", "ов", "ев",
     "а", "я", "у", "ю", "е", "ы", "и", "й", "ь"),
    key=len, reverse=True,
)


def _chave_ru(texto: str, vocabulario: frozenset[str]) -> str:
    """Forma de citação (nominativo) de um nome russo. Tira a desinência e procura o radical + (vazio, й, ь, а, я)
    no vocabulário: Авраама -> Авраам; Моисея -> Моисей; Иуды -> Иуда; Ноя -> Ной. Sem achado, fica como está
    (Авраам não tem desinência reconhecível no vocabulário e continua Авраам)."""
    for des in _DESINENCIAS_RU:
        if texto.endswith(des) and len(texto) - len(des) >= 2:
            radical = texto[: -len(des)]
            for suf in ("", "й", "ь", "а", "я"):
                if radical + suf != texto and radical + suf in vocabulario:
                    return radical + suf
    return texto


# ---- pontuação --------------------------------------------------------------------------------------------------

def _pontuacao_padrao(s: float, cov: float, esp: float) -> float:
    # a mesma fórmula de names_pt.choose antes do perfil: semelhança^2 * (0.5 + 0.5*cobertura) * (0.3 + 0.7*esp^0.3)
    return s * s * (0.5 + 0.5 * cov) * (0.3 + 0.7 * esp ** 0.3)


def _pontuacao_zh(s: float, cov: float, esp: float) -> float:
    # sem grafia para comparar: só cobertura e especificidade
    return cov * esp ** 0.3


# ---- nomes de palavras que não são núcleo de composto (por língua, o agente T1 confere) ---------------------------

NAO_NUCLEO = {
    "pt": frozenset({"Deus", "Senhor", "Jesus", "Cristo", "Espírito"}),
    "es": frozenset({"Dios", "Señor", "Jesús", "Cristo", "Espíritu"}),
    "fr": frozenset({"Dieu", "Seigneur", "Éternel", "Jésus", "Christ", "Esprit"}),
    "de": frozenset({"Gott", "Herr", "Jesus", "Christus", "Geist"}),
    "ru": frozenset({"Бог", "Господь", "Иисус", "Христос", "Дух"}),
    "ar": frozenset({"الله", "الرب", "يسوع", "المسيح", "الروح"}),
    "hi": frozenset({"परमेश्वर", "यहोवा", "प्रभु", "यीशु", "मसीह", "आत्मा"}),
    "bn": frozenset({"ঈশ্বর", "সদাপ্রভু", "প্রভু", "যীশু", "যিশু", "খ্রীষ্ট", "আত্মা"}),
    "ur": frozenset({"خدا", "خداوند", "یسوع", "مسیح", "روح"}),
    "zh": frozenset({"上帝", "神", "耶和华", "主", "耶稣", "基督", "圣灵"}),
    "ja": frozenset({"イエス", "キリスト"}),
    "vi": frozenset({"Chúa", "Đức", "Trời", "Giê-xu", "Linh"}),
    "id": frozenset({"Allah", "TUHAN", "Tuhan", "Yesus", "Kristus", "Roh"}),
}


def _perfil_latino(lang: str, cand=_cand_latina, rom=_identidade, saida=_nfc, chave=_chave_identidade,
                   maiuscula="[^\\W\\d_]") -> Perfil:
    return Perfil(lang, cand, rom, saida, chave, _pontuacao_padrao, NAO_NUCLEO[lang], maiuscula=maiuscula)


PERFIS: dict[str, Perfil] = {
    # português: os valores de hoje (regex e trocas de names_pt), sem nenhuma mudança
    "pt": Perfil("pt", _cand_pt, _identidade, _nfc, _chave_identidade, _pontuacao_padrao, NAO_NUCLEO["pt"],
                 maiuscula="[A-ZÀ-Ý]"),
    "es": _perfil_latino("es", maiuscula="[A-ZÀ-Ý]"),
    "fr": _perfil_latino("fr", maiuscula="[A-ZÀ-Ý]"),
    "de": _perfil_latino("de", chave=_chave_de, maiuscula="[A-ZÀ-Ý]"),
    "ru": Perfil("ru", _cand_ru, _rom_ru, _nfc, _chave_ru, _pontuacao_padrao, NAO_NUCLEO["ru"],
                 maiuscula="[А-ЯЁ]"),
    "zh": Perfil("zh", _cand_nenhum, _identidade, _nfc, _chave_identidade, _pontuacao_zh, NAO_NUCLEO["zh"],
                 limites_de_palavra=False, captura=False, min_captura=2, usa_marcados=True, limiares=LIMIARES_ZH),
    "ja": Perfil("ja", _cand_ja, _rom_ja, _nfc, _chave_identidade, _pontuacao_padrao, NAO_NUCLEO["ja"],
                 limites_de_palavra=False, captura=False, min_captura=2),
    "hi": Perfil("hi", _cand_hi, _rom_hi, _nfc, _chave_identidade, _pontuacao_padrao, NAO_NUCLEO["hi"],
                 captura=False),
    "bn": Perfil("bn", _cand_bn, _rom_bn, _nfc, _chave_identidade, _pontuacao_padrao, NAO_NUCLEO["bn"],
                 captura=False),
    "ur": Perfil("ur", _cand_ur, _rom_ar, _saida_ur, _chave_identidade, _pontuacao_padrao, NAO_NUCLEO["ur"],
                 captura=False),
    "ar": Perfil("ar", _cand_ar, _rom_ar, _saida_ar, _chave_identidade, _pontuacao_padrao, NAO_NUCLEO["ar"],
                 captura=False, palavras=_palavras_ar, sequencias=_sequencias_ar),
    "id": _perfil_latino("id", maiuscula="[A-ZÀ-Ý]"),
    "vi": _perfil_latino("vi", rom=_rom_vi, maiuscula="[^\\W\\d_]"),
}
assert set(PERFIS) == {"pt", *LINGUAS}, "todo idioma de LINGUAS precisa de perfil"


# ---- escrita esperada -------------------------------------------------------------------------------------------

_FAIXAS_ESCRITA = {
    "zh": ((0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF), (0x20000, 0x2FA1F)),
    "ja": ((0x3040, 0x30FF), (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xFF66, 0xFF9D)),
    "ar": ((0x0600, 0x06FF), (0x0750, 0x077F), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)),
    "ur": ((0x0600, 0x06FF), (0x0750, 0x077F), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)),
    "hi": ((0x0900, 0x097F),),
    "bn": ((0x0980, 0x09FF),),
    "ru": ((0x0400, 0x04FF),),
}


def escrita_ok(lang: str, texto: str) -> bool:
    """O texto está na escrita da língua? Letras de outra escrita (ou nenhuma letra) = False.

    Latino (pt, es, fr, de, id, vi): letras com LATIN no nome Unicode. Pontuação, espaço e marcas são livres.
    """
    letras = [c for c in texto if c.isalpha()]
    if not letras:
        return False
    if lang in ("pt", "es", "fr", "de", "id", "vi"):
        return all("LATIN" in unicodedata.name(c, "") for c in letras)
    faixas = _FAIXAS_ESCRITA[lang]
    return all(any(a <= ord(c) <= b for a, b in faixas) for c in letras)
