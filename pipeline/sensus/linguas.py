"""Línguas do app e a Bíblia de referência de cada uma para os nomes próprios (pacotes C1 a C5 da frente de línguas).

LINGUAS são as 12 línguas estrangeiras que ganham nomes, títulos e descrições. O português (pt) é a língua de origem
e não entra em LINGUAS: os arquivos dele são os legados (ver pipeline/sensus/correcoes.py).

BIBLIA_NOMES: a Bíblia cujas grafias servem de referência para os nomes próprios da língua. Os ids são os do catálogo
(pipeline/bibles/catalog.tsv); `indtsi` é auxiliar, vem de catalog-aux.tsv e não é empacotada: só alimenta os nomes
do indonésio.
"""

LINGUAS = ("es", "fr", "de", "ru", "zh", "ja", "hi", "bn", "ur", "ar", "id", "vi")

NOME_PT = {
    "pt": "português",
    "es": "espanhol",
    "fr": "francês",
    "de": "alemão",
    "ru": "russo",
    "zh": "chinês",
    "ja": "japonês",
    "hi": "hindi",
    "bn": "bengali",
    "ur": "urdu",
    "ar": "árabe",
    "id": "indonésio",
    "vi": "vietnamita",
}

BIBLIA_NOMES = {
    "pt": "blivre",
    "es": "spablm",
    "fr": "fralsg",
    "de": "deu1912",
    "ru": "russyn",
    "zh": "cmncbs",
    "ja": "jpnm",
    "hi": "hin2017",
    "bn": "benirv",
    "ur": "urdoucv",
    "ar": "arbvd",
    "id": "indtsi",
    "vi": "vieovcb",
}
