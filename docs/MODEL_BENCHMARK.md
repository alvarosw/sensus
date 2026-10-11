# Benchmark de modelos NVIDIA

Medição de velocidade e precisão dos modelos do provedor NVIDIA (build.nvidia.com) nas tarefas reais do app.
Script: `packages/core/tools/bench-models.ts`. Recomendações resultantes: `packages/core/src/ai/recommended-models.ts`.

## Método

**Tarefas (por modelo, 3 passagens).** Cada tarefa usa o mesmo fluxo do app: painel da seleção, unidade literária
como contexto (`literary.unit`), seleção como foco, `serializePanel`, `buildRichTextContext`.

| Passagem | Resumo (`summaryMessages`) | Pergunta (`answerMessages`) | Lente (`deepenMessages`) |
|---|---|---|---|
| Fp 2:5–8 | sim | "Por que Paulo diz que Cristo 'esvaziou a si mesmo' (2:7)…" | lingua |
| Fp 4:13 | sim | "Qual é o sentido de 'tudo posso naquele que me fortalece'…" | literario |
| Jo 1:1–3 | sim | "Por que João apresenta o Verbo como Deus…" | interpretacao |

Cada modelo roda 9 tarefas. Modelos com raciocínio também rodam no modo padrão (sem `enable_thinking=false`) para
comparação: os nemotron, por instrução, com as 9 tarefas.

**Configuração.** Igual ao app: `extraBody` do preset (`chat_template_kwargs.enable_thinking=false`), temperatura 0,2,
`maxTokens` 8000 (resumo e lente) ou 4000 (pergunta), `pt-BR`. Limite de 2 requisições simultâneas e 1,6 s entre
inícios (abaixo de 40 req/min). Uma nova tentativa após HTTP 429.

**Candidatos.** Os 45 modelos de chat de `GET /models` (filtro de `classifyModels`, `models.ts`), testados com um
"pronto" de 64 tokens (`probe`). Ids que a conta não tem (404 "not found for account") ficaram de fora.

**Métricas por execução.**

- Velocidade: tempo até o primeiro texto (`1º texto`) e total (`Total`), medianas das execuções bem-sucedidas.
- Completude: `@fim` recebido. No resumo, também os marcadores de todas as seções.
- Formato (0–1): resumo = marcadores (40%), 1 ou 2 perguntas `? ` por lente (20%), 3 a 5 perguntas em `@perguntas`
  (10%), frases de `@aplicacao` começando com "(Inferência)" (20%), nenhum "(Inferência)" em frase citada (10%).
  Pergunta e lente = 2 a 3 (ou 2 a 4) perguntas de seguimento (50%), sem marcadores perdidos (30%), com blocos (20%).
- Citações: precisão = válidas / (válidas + inválidas), com o segmentador do app (`parseCited`); cobertura = 1 −
  frases factuais sem citação / frases factuais. Citação = média das duas.
- Conflitos morfológicos: `claimsOf`, com `checkMorphClaims` (tokens citados contra afirmações de modo, tempo, caso etc.).
- Língua: palavras de inglês (the, and, with, which, because, therefore, however, this, that, are, is), caracteres
  CJK, linhas de tabela, cercas de código e marcadores soltos. Cada ocorrência reduz 0,2 do item.
- Pontuação da execução (0–100) = 100 × (0,40 formato + 0,35 citações + 0,15 morfologia + 0,10 língua). Execução
  incompleta vale metade; erro vale 0.
- **Precisão** = média das pontuações das 9 execuções (erros contam 0).
- **Velocidade** = 100 × clamp((120 − total mediano em s) / 110, 0, 1).
- **Geral** = 0,8 × precisão + 0,2 × velocidade. Usado para ordenar.

## Resultados

Tabela gerada por `npx tsx packages/core/tools/bench-models.ts report` (9 execuções por linha; "Sem citação" e
"Erros de língua" são somas das 9).

| Modelo | Raciocínio | Erros | Completos | 1º texto (s) | Total (s) | Cit. válidas / inválidas | Sem citação | Conflitos morfo | Erros de língua | Precisão | Geral |
|---|---|---|---|---|---|---|---|---|---|---|---|
| google/gemma-4-31b-it | desligado | 0 | 9 | 46,6 | 63,3 | 170 / 8 | 10 | 0 | 2 | 95,3 | **86,5** |
| nvidia/nemotron-3-ultra-550b-a55b | desligado | 0 | 9 | 2,4 | 43,3 | 252 / 4 | 191 | 1 | 41 | 90,4 | 86,3 |
| nvidia/nemotron-3-super-120b-a12b | desligado | 0 | 8 | 2,0 | 7,6 | 243 / 10 | 28 | 0 | 6 | 82,0 | 85,6 |
| moonshotai/kimi-k3 | desligado | 0 | 9 | 29,1 | 143,6 | 307 / 0 | 26 | 0 | 16 | 95,4 | 76,3 |
| deepseek-ai/deepseek-v4.1-flash | desligado | 0 | 8 | 33,7 | 87,6 | 332 / 0 | 23 | 0 | 50 | 87,5 | 75,9 |
| poolside/laguna-xs-2.1 | desligado | 0 | 9 | 4,2 | 92,3 | 155 / 47 | 96 | 4 | 2 | 84,4 | 72,6 |
| meta/muse-glimmer-30b | desligado | 0 | 9 | 46,6 | 139,0 | 226 / 1 | 44 | 2 | 39 | 89,8 | 71,9 |
| openai/gpt-oss-20b | desligado | 1 | 8 | 59,1 | 87,8 | 232 / 1 | 22 | 2 | 60 | 81,8 | 71,3 |
| nvidia/nemotron-3-super-120b-a12b | **padrão** | 2 | 6 | 23,8 | 27,7 | 129 / 0 | 8 | 0 | 1 | 67,3 | 70,6 |
| nvidia/nemotron-3-ultra-550b-a55b | **padrão** | 0 | 5 | 17,4 | 58,0 | 364 / 2 | 41 | 1 | 10 | 67,7 | 65,5 |
| nvidia/nemotron-3.5-lightning-30b-a3b | desligado | 0 | 5 | 1,7 | 46,5 | 97 / 24 | 248 | 1 | 4 | 64,1 | 64,7 |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning | desligado | 1 | 5 | 1,5 | 29,6 | 27 / 844 | 71 | 0 | 1 | 54,0 | 59,6 |
| meta/llama-3.2-11b-vision-instruct | desligado | 0 | 6 | 3,1 | 64,5 | 0 / 15 | 352 | 0 | 7 | 49,8 | 49,9 |
| meta/llama-3.2-90b-vision-instruct | desligado | 5 | 4 | 189,9 | 472,5 | 29 / 3 | 9 | 0 | 0 | 40,9 | 32,7 |
| nvidia/nemotron-3.5-lightning-30b-a3b | **padrão** | 0 | 2 | 88,6 | 103,4 | 281 / 79 | 964 | 1 | 1808 | 33,0 | 29,4 |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning | **padrão** | 4 | 2 | 231,5 | 259,2 | 111 / 24 | 3665 | 2 | 482 | 25,7 | 20,6 |
| z-ai/glm-5.3-flash | desligado | 8 | 1 | 78,6 | 92,9 | 13 / 1 | 8 | 0 | 0 | 10,3 | 13,1 |
| z-ai/glm-5.3 | desligado | 9 | 0 | – | – | 0 / 0 | 0 | 0 | 0 | 0,0 | 0,0 |

**Fora da tabela (não testados ou sem resposta utilizável):**

- 404 "not found for account" no `probe`: yi-large, jamba-1.5-large, sea-lion-7b, dbrx, gemma-2b, gemma-3-12b/4b,
  recurrentgemma-2b, granite-3.0 (3b e 8b), llama2-70b, phi-3-vision, phi-3.5-moe, mistral-7b, mistral-large,
  mistral-large-2, mixtral-8x22b, kimi-k2.6, mistral-nemo-12b, llama-3.1-nemotron (51b, 70b, ultra-253b),
  llama3-chatqa-1.5-70b, mistral-nemo-minitron-8b, nemotron-4-340b, nemotron-nano-3-30b, palmyra (4 ids), zamba2-7b.
- deepseek-v4.1-flash: o primeiro `probe` expirou (240 s sem dados). Na execução, respondeu nas 9 tarefas (8 completas).
- llama-3.2-90b-vision: 4 erros de HTTP 400, "maximum context length is 32768 tokens": o contexto do app somado ao
  limite de saída excede o limite do modelo. Não serve ao app.
- glm-5.3: nenhuma tarefa retornou texto com o raciocínio desligado (9 de 9). Não foi testado no modo padrão.
- Outros erros foram transitórios (fila do NVIDIA: `ResourceExhausted`; HTTP 404 e 500 intermitentes do
  muse-glimmer). Esses ids foram executados de novo, uma vez, e só os resultados desta segunda rodada entram na tabela.

## Conclusões

1. **Raciocínio desligado é melhor** para estes modelos. No modo padrão, todos os nemotron perdem precisão e
   completude; o lightning escreve o raciocínio em inglês dentro da resposta (1808 ocorrências), o nano-omni gera
   saídas de até 70 mil caracteres sem fechar. Mantém-se `enable_thinking=false` no preset.
2. **Gemma 4 31B é o melhor equilíbrio**: precisão 95,3, 9 de 9 completas, 10 frases sem citação no total, zero
   conflitos morfológicos. O custo é o primeiro texto em cerca de 47 s e o total em cerca de 63 s.
3. **Nemotron 3 Ultra** (padrão anterior): mais rápido (1º texto em 2,4 s, total em 43 s), mas precisão 90,4 e
   191 frases factuais sem citação (a maior parte nas respostas em listas).
4. **Nemotron 3 Super** é o mais rápido por larga margem (total em 7,6 s), com precisão 82,0 e 10 citações inválidas.
   Serve à pergunta rápida, não ao resumo que precisa ser fiel.
5. **Kimi K3** tem a maior precisão (95,4, nenhuma citação inválida), mas leva 144 s em média. Só vale para quem
   prefere esperar.
6. **Spot-read em pt-BR**: textos fluentes nos quatro recomendados. Problema de formato: citações com colchete
   simples (`[tok:…]`), que o app não transforma em chips (gemma 21 casos, ultra 15, super 30), e um id inventado
   `[[contexto]]` no super.

## Recomendação

`RECOMMENDED_MODELS.nvidia`, ordem do melhor geral: Gemma 4 31B (padrão, equilibrado), Nemotron 3 Ultra (equilibrado),
Nemotron 3 Super (rápido), Kimi K3 (preciso). `presets.ts` passa a usar `google/gemma-4-31b-it` como padrão.

## Limitações

- Uma amostra por tarefa e passagem (9 por modelo), com temperatura 0,2. Diferenças de 1 a 2 pontos são ruído.
- As métricas de citação dependem do segmentador do app; a aproximação de frases "sem citação" pode errar em frases
  com abreviações atípicas. A medição cobre o que o app consegue classificar: não mede a acurácia teológica.
- Conflitos morfológicos só aparecem quando o texto faz uma afirmação que o checador entende.
- O problema de NVIDIA (fila, 404 intermitentes) afeta a medição de velocidade. Os tempos são de uma janela de
  cerca de duas horas, com carga variável.
- A pontuação "Geral" é uma escolha de peso (80% precisão, 20% velocidade), não uma verdade. Os números brutos estão
  na tabela para quem preferir outro peso.

## Reproduzir

```bash
npx tsx packages/core/tools/bench-models.ts probe                 # lista e testa os candidatos
npx tsx packages/core/tools/bench-models.ts run --models a,b      # roda as tarefas (retoma o que existe)
npx tsx packages/core/tools/bench-models.ts report                # tabela
```

Saídas (`runs.jsonl`, `probe.jsonl`, textos brutos) ficam em `tmp/bench-models/` (ignorado pelo git). Chave e URL vêm
do `.env`; nada é impresso.
