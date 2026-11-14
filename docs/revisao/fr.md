# Revisão por amostragem — francês (fr)

Tradição Louis Segond 1910 (`fralsg`), que é também a Bíblia de onde vêm as grafias dos nomes de confiança alta.
Formas conferidas no texto da fralsg alinhado à KJV (ex.: Kénan em Gn 5:9, Arpacschad em Gn 11:10, Schélach em
Gn 11:12, "porte des enfants du peuple" em Jr 17:19, "lieu appelé Crâne" em Lc 23:33).

- **Semente:** `random.Random(5150)` (nomes: `sample` de 50 `revisado` e depois 30 `auto`/`alta`, na ordem do TSV;
  títulos: 45 dos 450 `revisado`; descrições por regra: 20 TIPNR + 10 geo, de `sorted` dos cite_id de `entity_text`).
- **Amostra:** 80 nomes, 45 títulos (10%), 30 descrições por regra e as 9 de prosa de `descricoes.tsv` (todas).

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 50 | 0 | 0% |
| Nomes `alta` | 30 | 0 | 0% |
| Títulos (nome com a forma de Lucas num evento do Gênesis) | 45 | 2 | 4% |
| Descrições por regra (corrigíveis no fr: "Appelé" com cargo feminino, rótulos do geo) | 30 | 3 | 10% |
| Descrições por regra (limitação herdada: texto inglês no geo) | 30 | 5 | 17% |
| Prosa TIPNR (cabeçalho com ref OSIS e ")", sem elisão) | 4 | 4 | 100% |
| Prosa Theographic (sem elisão, nomes fora da Segond) | 5 | 3 | 60% |

Observações sem erro: "Amminadib" (Ct 6:12) e "Beno" (1Ch 24:26) mantidos, embora a Segond os traduza; "Vallée de
Ben-Hinnom" para *Valley of Hinnom* (forma mais frequente na Segond).

## Correções

- **Títulos (sistemático, 9 linhas):** os eventos de nascimento/vida/morte das genealogias de Gn 5 e 11 usavam a
  forma de Lc 3 (`Kaïnan`, `Arphaxad`, `Sala`). Passam a "Kénan", "Arpacschad", "Schélach", como na Segond do Gênesis.
  Os nomes das entidades de Lucas continuam com a forma de Lucas. Nota "rev. amostragem".
- **Citação nas descrições (sistemático, gramática):** "Appelé"/"Appelé uniquement" não concordava com cargo
  feminino (Femme, Reine, Ville, Divinité…, 157 descrições). A citação não conhece o gênero do cargo, então a
  gramática passou a uma forma neutra: "Noms : …" e "Nom unique : …".
- **Rótulos do geo (`glossario-geo.tsv`):** `identified_adjective` "identifié" → "identifié (adjectif)";
  `authority_preserved` "autorité conservée" → "autorité : nom conservé".
- **Prosa TIPNR (Juda, David, Moïse, Aaron):** cabeçalho no formato da regra ("…, de l'époque de … ; première mention
  en Gn 29:35.") em vez de "mentionné pour la première fois en Gen.29.35)"; "monarchie unie" → "unifiée"; elisão
  ("d'Éliab", "d'Amnon", "d'Aaron", "d'Éliézer", "d'Élischéba"); citação "Noms : …".
- **Prosa Theographic:** elisão "de Isaï" → "d'Isaï" (3); "Goshen" → "Gosen", "Penuel" → "Peniel" (Segond);
  "Jehovah" → "Jéhovah".

## Riscos que ficam

- **Geo por regra:** nome moderno e texto da identificação em inglês por desenho (`geo_descricao.py`): "another name
  for Ahlab", "within 1 km of Beth-peor", "Babylon" (cerca de 496 das 1330 descrições geo têm texto inglês na
  identificação). Pede mudança de código para todas as línguas.
- **Relações sem "de" repetido:** "fils d'Amram et Jokébed", "épouse de Juda et Er". O francês cuidado repete a
  preposição ("et de Jokébed"); a regra junta a lista depois do termo da relação, então pede código.
- **Prosa Theographic** mantém as referências com nomes de livro em inglês ("Genesis 32:28"), como o pt.
- Só 2 das 4 linhas de prosa TIPNR entram (resumo do ingestor: `stepbible-tipnr revisado=2`); as outras 2 não casam
  com a descrição atual da fonte (chave a conferir).
- Apóstrofo: nomes da Segond usam "’" ("Colline d’Araloth"), títulos e descrições usam "'".
- 472 TIPNR e 2784 Theographic sem tradução por regra nem prosa: o app mostra o inglês/tradução automática.
