# Entrega da arquitetura: progresso

Estado vivo da migração descrita em [ARCHITECTURE.md](ARCHITECTURE.md) (alvo) e
[ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) (diagnóstico, §4 = passos numerados). Atualizado a cada etapa.

## Como o trabalho anda

- Branch de integração: `arquitetura` (worktree `.claude/worktrees/arquitetura`), criada de `release-1.1.1`
  (1.1.0 + painel da palavra + novas fontes). Quando a `main` avançar, `git merge main` aqui.
- Cada passo vira uma branch própria `arq/<passo>` criada a partir de `arquitetura`, feita por um agente Haiku em
  worktree isolada, em paralelo sempre que não houver conflito de arquivos.
- Ao voltar, cada branch passa pela skill `revisao-pre-merge` (npm run check + `/code-review`) e é juntada em
  `arquitetura` com `--no-ff`.
- Ao fim de cada lote grande: teste manual por um agente Sonnet com capturas (NT e AT, claro e escuro); as capturas
  são conferidas antes de seguir.
- No fim: `arquitetura` → `main` (local), `npm run check`, push.

## Lotes

| Lote | Passos (revisão §4) | Branches | Estado |
|---|---|---|---|
| 0 | Base: ARCHITECTURE.md, CLAUDE.md, skills, teste de arquitetura, `npm run check`, CI | `arquitetura` | feito |
| A | 1 domínio · 2 fixtures AT · 7 dividir repo · 13 contrato físico/pipeline · 5 registro de fontes | `arq/dominio`, `arq/fixtures-at`, `arq/repo-split`, `arq/contrato`, `arq/fontes` | feito (revisado com /code-review) |
| B | 3 migrar língua/testamento/léxico · 4 `isContentToken` por língua · 12 tradução | `arq/migrar-nucleo`, `arq/migrar-estudo`, `arq/migrar-paineis`, `arq/traducao` | feito (revisado; teste manual em andamento) |
| C | 8 desfazer ciclos e camadas · 9 formatadores únicos | `arq/ciclos` | feito (0 exceções) |
| D | 10 dividir lentes, prévia, cards e dados do estudo · 11 texto original por testamento (WLC no AT) | `arq/lentes`, `arq/folha` | feito |
| E | 15 fatiar `useStudy` · índices públicos das features · zerar exceções · noUnusedLocals | `arq/estado` | feito |
| T | Teste manual (Sonnet) após B, D e E; merge na `main` | — | — |

Passo 14 (registro no contrato do banco) fica fora: exige rebuild e release de dados; o registro no núcleo (passo 5)
com teste cobre o risco. Reavaliar depois.

## Registro

- 2026-10-16 23:40 — Lote 0 pronto (78 exceções iniciais no teste de arquitetura).
- 2026-10-17 00:20 — Lote A integrado em `arquitetura` (731 testes). /code-review: 3 correções aplicadas
  (strong_base tolerante, rótulo por obra da EGW, export duplicado); WordPanel TAHOT/TAGNT e filtro `% 1000`
  ficam para o lote B.
- 2026-10-17 00:25 — Lote B disparado: 4 agentes Haiku (núcleo, estudo, painéis, tradução).
- 2026-10-17 00:50 — Lote B: `arq/migrar-paineis` e `arq/migrar-estudo` integrados (752 testes, 52 exceções).
  Pendentes: `arq/migrar-nucleo` (isContentToken por língua no núcleo, contexto da IA, rich-text, panel) e
  `arq/traducao` (API única de tradução, `data/sources`).

- 2026-10-17 01:10 — Lote B integrado (785 testes, 39 exceções). /code-review: palavra-chave alinhada ao
  texto-base da IA (TR no NT, todo o AT inclusive Qere). Disparados em paralelo: teste manual (Sonnet, roteiro NT/AT
  em docs/screenshots/teste-lote-b/ da worktree dele) e lote C (`arq/ciclos`).

- 2026-10-17 02:20 — Retomada após o limite. Lote C integrado: lista de exceções VAZIA (camadas, ciclos,
  index.ts, literais), formatador de referência e dicionário de morfologia únicos; nav juntou-se a reader.
  Lote D disparado (`arq/lentes`: lentes por arquivo + original por testamento; `arq/folha`: prévia, cards,
  useStudyAi). Teste manual (Sonnet) retomado sobre `arquitetura`.

- 2026-10-17 03:30 — Lotes D e E integrados (873 testes, 0 exceções, noUnusedLocals ligado). /code-review de C+D
  sem bug (só um nome de variável). Teste manual final (Sonnet) em andamento sobre a versão integrada.

## Próximos passos (para quem retomar)

1. Esperar o relatório do teste manual (agente Sonnet). Conferir as capturas; bug confirmado → agente Haiku corrige
   numa branch `arq/fix-*` a partir de `arquitetura`, revisão, merge, nova captura do ponto corrigido.
2. Final: `git merge main` em `arquitetura`, `npm run check`, merge `--no-ff` de `arquitetura` na `main` (checkout
   principal), `npm run check` na `main`, push da `main`.
