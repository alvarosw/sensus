# Revisão por amostragem — espanhol (es)

Tradição Reina-Valera; a Bíblia es do app é a BLM (`spablm`), de onde vêm as grafias dos nomes de confiança alta.
Grafia da BLM não foi contada como erro (ex.: Tapú em 1Cr 2:43, Chileab, Gabbatha). Títulos com "Jesús" por decisão.

- **Semente:** `random.Random(2026)` (nomes: `sample` de 50 `revisado` e depois 30 `alta`; títulos: 45; descrições
  por regra: 30, das 5089 linhas de `entity_text` que não vêm do TSV de prosa).
- **Amostra:** 80 nomes, 45 títulos (10%), 30 descrições por regra e as 20 de prosa de `descricoes.tsv`.

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 50 | 0 | 0% |
| Nomes `alta` | 30 | 0 | 0% |
| Títulos | 45 | 0 | 0% |
| Descrições por regra (corrigíveis no es) | 30 | 2 | 6,7% |
| Descrições por regra (limitação herdada: texto inglês) | 30 | 8 | 27% |
| Prosa TIPNR | 8 | 8 | 100% |
| Prosa Theographic | 12 | 2 | 17% |

Nomes e títulos: pessoa/lugar conferidos pelo versículo (BLM e WEB); grafias conforme RV1960 ou BLM. Fora da amostra,
dois nomes errados achados ao investigar as descrições (abaixo).

## Correções

- **Gênero da citação (sistemático):** "Llamado"/"Solo llamado" não concordava com mulheres ("Solo llamado
  Abigail"). A gramática passou a usar a forma impessoal "Se le llama" / "Solo se le llama" (todas as descrições).
- **Eufonia (sistemático):** "Eleazar y Itamar", "Ozni o Oznite" — 39 casos de `y` antes de i/hi e ~10 de `o` antes
  de o/ho. Nova regra pura `eufonia_es` (`pipeline/sensus/flexao.py`), ligada por `pos eufonia_es` na gramática es,
  com testes (AT: Êx 4:14; NT: Ὀζίας, Mt 1:9). Depois da regra: 0 ocorrências.
- **Prosa TIPNR (8 linhas: Judá, Davi, Moisés, Arão, Levi, Saul, Abraão, Salomão):** cabeçalho em minúscula, ref OSIS
  com parêntese solto ("Gen.29.35)"). Reescritas no formato da regra ("Rey de Judá, de la época de la monarquía
  unida; primera mención en Rt 4:17.").
- **Prosa Theographic:** "Jehovah" → "Jehová"; "la Nahash" → "la Nahas".
- **Nomes:** `Destruction` (Is 19:18) "Destrucción" → "Ciudad de la Destrucción"; `Kiriathaim` tinha duas grafias
  (Quiriataim/Quiriatáim), o que tirava o nome do mapa global e deixava "cerca de Kiriathaim" em inglês; as duas
  linhas ficaram "Quiriataim" (RV1960).

## Riscos que ficam

- **Geo por regra:** o texto da identificação e o nome moderno ficam em inglês por desenho
  (`geo_descricao.py`): "another name for Edom", "Ethiopia", "Nicopolis". Pede mudança de código para todas as
  línguas (no pt o texto é revisado à mão).
- **Nomes sem forma es nas citações** caem no inglês, como no pt: "Horite", "Oznite", "Aramiac", "Shaveh Kiriathaim",
  "Beth-horon Upper", "Holy Place".
- **Prosa Theographic** mantém as referências com nomes de livro em inglês ("Genesis 32:28"), como o pt.
- `Naphoth-dor` aparece como "Dor" (igual ao pt): ambíguo com a cidade de Dor.
- 479 descrições TIPNR sem tradução por regra e 2777 Theographic sem prosa: o app mostra o inglês/tradução automática.
