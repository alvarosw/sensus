"""Flexão de nomes próprios para as descrições traduzidas por regra (sensus/descricoes_pt.py). Funções puras.

genitivo_ru é conservador: só nome de uma palavra, em cirílico, com desinência que não deixa dúvida. O resto devolve
None e a descrição cai na tradução automática (não se chuta uma forma errada).
genitivo_bn: sufixo genitivo bengali ('র' depois de vogal; 'ের' depois de consoante, na grafia com sinal dependente).
elisao_fr: 'de Abraão' -> "d'Abraão" (só antes de vogal; 'h' fica como está, por cautela com h aspirado).
eufonia_es: 'y' -> 'e' antes de i/hi e 'o' -> 'u' antes de o/ho ('Eleazar e Itamar').

Regra nova = função pura com teste, com caso de AT hebraico e de NT grego (ver pipeline/tests).
"""

import re

_RU_NOME = re.compile(r"[А-ЯЁ][а-яё]+")
_RU_CONSOANTE = "бвгджзклмнпрстфхцчшщ"  # sem й, ь e ъ (tratados à parte)
_RU_A_APOS_HARDE = "бвдзлмнпрстфц"  # 'а' final vira 'ы' (Иуда -> Иуды)
_RU_A_APOS_GUTURAL = "гкхжчшщ"  # 'а' final vira 'и' (Лука -> Луки)


def genitivo_ru(nome: str) -> str | None:
    """Genitivo de nome masculino russo de uma palavra; None quando não dá para decidir com segurança.

    Авраам -> Авраама; Моисей -> Моисея; Ной -> Ноя; Иуда -> Иуды; Илия -> Илии. Ь final, outras vogais e nomes
    com espaço, hífen ou letra latina: None.
    """
    if not _RU_NOME.fullmatch(nome):
        return None
    fim, antes = nome[-1], nome[-2]
    if fim == "й":
        return nome[:-1] + "я"
    if fim in _RU_CONSOANTE:
        return nome + "а"
    if fim == "а":
        if antes in _RU_A_APOS_GUTURAL:
            return nome[:-1] + "и"
        if antes in _RU_A_APOS_HARDE:
            return nome[:-1] + "ы"
        return None
    if fim == "я" and antes == "и":
        return nome[:-1] + "и"
    return None


# Bengali: sinais vocálicos dependentes e vogais independentes (U+0985-U+0994) terminam em vogal.
_BN_VOGAL_DEP = frozenset(chr(c) for c in (0x09BE, 0x09BF, 0x09C0, 0x09C1, 0x09C2, 0x09C3, 0x09C7, 0x09C8, 0x09CB, 0x09CC))
_BN_VOGAL_IND = frozenset(chr(c) for c in range(0x0985, 0x0995))
_BN_NOME = re.compile(r"[ঀ-৿]+")


def genitivo_bn(nome: str) -> str:
    """Genitivo bengali: vogal final -> 'র' (মোশির); consoante, virama ou anusvara final -> 'ের' (যোহনের).

    Levanta ValueError para nome que não está em bengali: quem chama deve checar a escrita antes.
    """
    if not _BN_NOME.fullmatch(nome):
        raise ValueError(f"nome fora da escrita bengali: {nome!r}")
    fim = nome[-1]
    if fim in _BN_VOGAL_DEP or fim in _BN_VOGAL_IND:
        return nome + "র"
    return nome + "ের"


_FR_VOGAL = "AEIOUÂÀÄÉÈÊËÎÏÔÖÙÛÜŸÆŒaeiouâàäéèêëîïôöùûüÿæœ"
_FR_DE = re.compile(r"\b([dD])e ([" + re.escape(_FR_VOGAL) + r"])")


def elisao_fr(texto: str) -> str:
    """Elisão do 'de' antes de vogal: "de Abraham" -> "d'Abraham"; "De Élie" -> "D'Élie"."""
    return _FR_DE.sub(lambda m: m.group(1) + "'" + m.group(2), texto)


# Espanhol: 'y' soa /i/ antes de i- e hi- (não antes de hia-, hie-, hio-, hiu-, que soam /j/); 'o' antes de o- e ho-.
_ES_Y = re.compile(r"(?<=\s)y (?=[IiÍí]|[Hh][IiÍí](?![aeiouáéíóú]))")
_ES_O = re.compile(r"(?<=\s)o (?=[OoÓó]|[Hh][OoÓó])")


def eufonia_es(texto: str) -> str:
    """Conjunções do espanhol diante do mesmo som: 'Eleazar y Itamar' -> 'Eleazar e Itamar'; 'Ozni o Oznite' ->
    'Ozni u Oznite'. 'y Hierro' e 'o Abiú' ficam como estão."""
    return _ES_O.sub("u ", _ES_Y.sub("e ", texto))
