# Revisão por amostragem — hindi (hi)

Tradição OV/IRV (`hin2017`: मूसा, एलिय्याह, यूहन्ना, पतरस), que é também a Bíblia de onde vêm as grafias dos nomes.
Formas conferidas no texto da hin2017 (ex.: होदव्याह 4× contra होदवा 1×; "मनुष्यों के पकड़नेवाले", Mt 4:19).

- **Semente:** `random.seed(5114)` (nomes: `random.sample` de 50 `revisado` e depois 30 `auto`/`alta`; títulos: 45;
  descrições por regra: 30, na ordem de `entity_text.jsonl` do hi).
- **Amostra:** 80 nomes, 45 títulos (10%), 30 descrições por regra. Não há prosa (`descricoes.tsv` do hi não existe).

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 50 | 1 | 2% |
| Nomes `alta` | 30 | 1 | 3% |
| Títulos | 45 | 1 (estilo) | 2% |
| Descrições por regra (conteúdo) | 30 | 0 | 0% |
| Descrições por regra (estilo: falta vírgula entre cargo e época) | 30 | 15 | 50% |

O geo deixa o nome moderno e a identificação em inglês por desenho; não contado como erro.

## Correções

- **Nomes:** `Hodaviah` होदवा → होदव्याह (forma de 4 dos 5 versículos); `Carmel` कर्मेली → कर्मेल (o gentílico
  "carmelita" tinha ficado como nome do lugar, confiança alta).
- **Gentílico no lugar do nome (sistemático):** procura de linhas em que o valor é a alternativa + ी/वासी/ों. Além de
  Carmel, mais duas: `Jezreel` यिज्रेली → यिज्रेल, `Pirathon` पिरातोनी → पिरातोन.
- **Título:** "Fishers of Men" मनुष्यों के मछुवे बनाने का बुलावा → मनुष्यों के पकड़नेवाले बनाने का बुलावा (a
  expressão da hin2017).
- **Gramática (sistemático):** `frase_tempo_sem_comp` passa a `{frase}{pont.,} {tempo}`. Antes saía "पुरुष पितरों
  के समय" (sem a vírgula, lê-se torto); agora "पुरुष, पितरों के समय", como já era com complemento.
- **Rodapé da linha do tempo** (`app/src/i18n/locales/hi/timeline.ts`): sai a menção a IA; fica "Sensus परियोजना का
  अनुकूलन".

## Riscos que ficam

- "Aramiac" (16 descrições: Daniel, Esdras) vem do TIPNR e aparece igual no pt; pede correção em código para todas as
  línguas.
- Formas duplicadas em "जिसे … कहा जाता है" (ex.: अजर्याह duas vezes, uma por grafia hebraica) também vêm da fonte.
- Nomes de baixa frequência com várias grafias na hin2017 (como Hodaviah) ficam com uma forma só por nome inglês.
