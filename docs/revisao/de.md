# Revisão por amostragem — alemão (de)

Tradição Lutero 1912 (`deu1912`), que é também a Bíblia de onde vêm as grafias dos nomes de confiança alta. Formas
conferidas no texto da deu1912 (ex.: Henochiter em 4Mo 26:5, Gaderiter, Thisbiter).

- **Semente:** `random.seed(5)` (nomes: `random.sample` de 50 `revisado` e depois 30 `auto`/`alta`; títulos: 45;
  descrições por regra: 30, de `sorted` dos cite_id de `entity_text` do de).
- **Amostra:** 80 nomes, 45 títulos (10%), 30 descrições por regra. Não há prosa (`descricoes.tsv` do de não existe).

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 50 | 1 | 2% |
| Nomes `alta` | 30 | 0 | 0% |
| Títulos (erro de fato ou frase forçada) | 45 | 5 | 11% |
| Títulos (estilo: "Jesus Christus"/"Simon Petrus" como sujeito) | 45 | 9 | 20% |
| Descrições por regra (corrigíveis no de) | 30 | 7 | 23% |
| Descrições por regra (limitação herdada: texto inglês no geo) | 30 | 6 | 20% |

## Correções

- **Nomes:** `Decapolis` "Dekapolis" → "Zehn Städte" (Lutero: "die Zehn Städte", Mt 4:25; Mk 5:20).
- **Títulos (sistemático, 119 linhas):** "Jesus Christus" → "Jesus" (97), "Simon Petrus" → "Petrus" (20),
  "Johannes der Apostel" → "Johannes"; genitivo onde "von Jesus Christus" ficava pesado ("Geburt Jesu", "Die
  Verklärung Jesu"); ordinal com ponto ("Jerobeam I.", "Herodes Agrippa I."); títulos com prefixo de participantes
  ("Jesus Christus und Simon Petrus: die Rede vom Brot des Lebens") e frases forçadas reescritas ("Die Bekehrung des
  Paulus", "Das Apostelkonzil in Jerusalem", "Die Gläubigen haben alles gemeinsam"). Nota "rev. amostragem".
- **Gentílicos nas descrições (sistemático):** 117 nomes "-ite" ficavam em inglês em "Bezeichnet als …" ("Kaleb oder
  Calebite", "Hittite", "Levite"; 131 ocorrências). Entraram na seção `nome` de `glossario-descricoes.tsv` com a forma
  da Lutero 1912 ("Kalebiter", "Hethiter", "Levit"). Depois: 0 ocorrências (fica só "Melite", que é Malta, correto).
- **Rótulos do geo (`glossario-geo.tsv`):** "Geometrie: Pfad" → "Linie"; "Autorität meist" → "Autorität üblich";
  "identifiziert: gewesen: 2" (dois-pontos duplos) → "identifiziert (war): 2", idem "(ist)" e "(Adjektiv)";
  "Konfidenz Karte" → "Konfidenz laut Karte".

## Riscos que ficam

- **Geo por regra:** nome moderno e texto da identificação em inglês por desenho (`geo_descricao.py`): "near the mouth
  of the Jordan River", "another name for Acco", "Jezreel Valley" (372 das 1330 descrições geo). Pede mudança de
  código para todas as línguas.
- **Variantes sem forma de** caem no inglês, como no pt ("Shamur" em 1Chr 24:24).
- `Magadan` → "Magdalena" (linha `auto`/`alta`, 14 versículos de Maria Magdalena): a entidade junta lugar e epíteto,
  igual ao pt ("Madalena").
- `Shephelah` → "Sephela": a Lutero traduz ("Gründe", "Niederung"); mantido como nome de região.
- Títulos "Geburt von X" / "Tod von X" / "Herrschaft von X" (166) são corretos, mas menos elegantes que o genitivo.
- 438 TIPNR e 2789 Theographic sem tradução por regra nem prosa: o app mostra o inglês/tradução automática.
