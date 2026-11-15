# Revisão por amostragem — bengali (bn)

Tradição BBS/IRV (linha Carey), que é também a Bíblia de onde vêm as grafias: `benirv` (মোশি, যোহন, পিতর,
যিরূশালেম). Só nomes: o bengali ainda não tem títulos de eventos nem gramática de descrições.

- **Semente:** `random.Random(1416)` (`sample` de 50 `revisado` e depois 30 `auto`/`alta` de `nomes.tsv`).
- **Amostra:** 80 nomes, conferidos nos versículos da entidade (texto da `benirv`) e na KJV. A amostra foi tirada
  depois da checagem automática abaixo.

## Checagem automática (antes da amostra)

Cada linha `revisado` de `nomes.tsv` e de `nomes-manuais.tsv` procurada (NFC, sem ZWNJ/ZWJ, início de palavra,
sufixo de caso livre) nos versículos do nome. **199 de 1819 não apareciam (11%).** Destes:

- **~150 corrigidos para a forma do texto.** Padrões: hasanta e vogal longa/curta (ইল্হানন → ইলহানন,
  শমগর → শম্গর, আলেকসান্দার → আলেকসান্দর); hífen onde o texto junta ou o contrário (বাল-গাদ → বাল্গাদ,
  বৈৎশেমশ → বৈৎ-শেমশ); visarga final (যারহ → যারঃ); nomes que o texto traz de outro jeito (Artemis → দীয়ানা,
  Athens → আথীনী, Mizraim → মিশর, Rhegium → রাগী, Manaen → মনহেম); "Most Holy Place" → মহাপবিত্র স্থান,
  "John the Baptist" → যোহন বাপ্তিষ্মদাতা.
- **5 passaram a `sem`:** o texto traduz o nome (Beth-haggan "বাগানবাড়ি", Hammelech "রাজপুত্র", Misgab "দুর্গ",
  Helech).
- **48 ficaram:** quebra de palavra no próprio texto (তবে রা, নো দ, শে নের), nomes que o texto omite ou traduz
  (Jubal, Corban, Ethbaal), entidades numeradas ou descritivas (পবিত্র স্থান ১, উত্তর দ্বার).

Uma segunda checagem por linha (versículos em que o candidato da linha aparece) achou grafias do revisor que não
são as do texto dessa entidade: Egypt মিসর → মিশর (475 contra 1), Samson শিমশোন → শিম্শোন, Naaman নামন → নামান,
Felix, Amos, Kadmiel, Shema, Mesha e outras (~40). Os compostos que dependiam do núcleo trocado (মিশর নদী,
কর্মিল পর্বত, যিষ্রিয়েল উপত্যকা) foram refeitos e marcados `revisado`.

## Erros da amostra

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 50 | 2 (Hanan হানান → হানন; Nebajoth নবায়োত → নবায়োৎ) | 4% |
| Nomes `alta` | 30 | 1 (Jabez যাবেষে, locativo → যাবেষ) | 3% |

Formas diferentes por entidade (Jehiel যিয়ীয়েল em 1Cr 11:44, Shammua সম্মুয় em Ne 12:18) são as do texto daquela
passagem e não contam como erro.

## Padrões sistemáticos corrigidos

- **৷ colado ao nome:** a `benirv` usa ৷ (U+09F7) como danda, e `_TOKEN_BN` (`pipeline/sensus/escritas.py`) o
  aceitava como letra: saíam যোষেফ৷, শিমিয়ি৷, ঊরি৷ (8 linhas, 5 delas usadas). O token agora exclui ৲–৻; teste em
  `test_escritas.py`.
- **Gentílico no lugar do nome:** Carmel কর্মিলীয় → কর্মিল, Abiezer অবীয়েষ্রীয় → অবীয়েষর, Jezreel, e na varredura
  Ammon, Gedor, Beeroth, Pirathon, Gederah, Elkosh, Gilo, Harod, Hushah, Shaalbon, Meronoth, Menuhoth, Baharum
  (sem "-ীয়").

## Riscos que ficam

- Nomes com várias grafias na `benirv` ficam com uma forma por linha; o revisor anterior uniformizou alguns
  (অনাথোৎ para অনাথোত/অনাথোতে) e isso foi mantido.
- Quando só há gentílico no texto (Elkosh, Gilo, Baharum), o nome do lugar foi tirado dele, sem atestação direta.
- O texto tem erros próprios (Ethbaal "ঈষেবলের মেয়ে ঈষেবল", হর্ম্মিপাত্রোবা): ficou a forma do revisor.

## Segunda rodada: títulos e descrições por regra

- **Semente:** `random.Random(1417)` para os títulos (`sample` de 45 de `titulos-eventos.tsv`) e
  `random.Random(1418)` para as descrições (`sample` de 30 de `entity_text.jsonl`, TIPNR e openbible-geo, comparadas
  com o pt). Nomes não foram reamostrados; os dos títulos da amostra batem com `nomes.tsv`. Não há descrições em
  prosa (`descricoes.tsv`) para bn.
- **Glossário `nome` das descrições:** tinha 238 entradas, 154 copiadas de candidatos `auto` de confiança
  `media`/`baixa` de `nomes.tsv`, não revisados. Ficaram só as 84 que batem com linha `revisado` ou `auto`/`alta`
  (ou que não vêm de `nomes.tsv`). Cobertura das descrições TIPNR por regra: **2708 (63%) → 2403 (56%)**.

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Títulos | 45 | 4 (Jeroboam I "যারবিয়াম ১-এর"; "Discourse on the Kingdom" sem "উপদেশ"; Matthias e Mary sem verbo) | 9% |
| Descrições por regra | 30 | 25 com ao menos um erro, quase todos do mesmo modelo (abaixo) | 83% |

Correções:

- **Títulos:** প্রথম/দ্বিতীয় যারবিয়াম (as 3 linhas com numeral), রাজ্য বিষয়ক উপদেশ ও অন্যান্য দৃষ্টান্ত,
  মত্তথিয় যিহূদার স্থলাভিষিক্ত হন, মরিয়ম যীশুকে অভিষেক করেন.
- **Gramática (`gramatica-descricoes.tsv`), sistemático:** a época vinha depois do cargo ("একজন মানুষ বিভক্ত রাজত্বের
  যুগের", 19 da amostra); agora vem antes ("বিভক্ত রাজত্বের যুগের লেবি গোষ্ঠীর একজন মানুষ"). "perto de X" saía
  sem genitivo ("ঐন কাছাকাছি একটি স্থান") e passou a "ঐন এলাকার কাছের". `geo_outros` não tinha verbo; agora
  "এই ডেটাসেটে আরও {n}টি সম্ভাব্য আধুনিক অবস্থান আছে৷".

Riscos:

- Identificação antiga do openbible-geo em inglês quando é nome simples ("Moab 2", "Egypt", "Elam", 3 da amostra):
  `geo_descricao.py` não traduz nomes; vale para todas as línguas de escrita não latina.
- Referências e números com algarismos latinos (যাত্রা 4:14, 306/1000); a BBS usa algarismos bengalis.
