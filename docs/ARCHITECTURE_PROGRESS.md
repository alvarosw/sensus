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
| B | 3 migrar língua/testamento/léxico · 4 `isContentToken` por língua · 12 tradução | `arq/migrar-nucleo`, `arq/migrar-estudo`, `arq/migrar-paineis`, `arq/traducao` | em andamento |
| C | 8 desfazer ciclos e camadas · 9 formatadores únicos | `arq/ciclos` | depois de B |
| D | 10 dividir lentes e prévia · 11 texto original por testamento (WLC no AT) | `arq/lentes`, `arq/original-at` | depois de C |
| E | 15 fatiar `useStudy` · índices públicos das features · zerar exceções | `arq/estado` | por último |
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

## Próximos passos (para quem retomar)

1. Para cada branch pendente do lote B (`arq/migrar-nucleo`, `arq/traducao`): `git log arquitetura..<branch>`.
   Com commits e `npm run check` verde na worktree dela → `git merge --no-ff` em `arquitetura`, resolver
   `tests/architecture-exceptions.ts` regerando (`UPDATE_ARCH_EXCEPTIONS=1 npx vitest run tests`) e conferir que
   nenhum item novo apareceu em relação às duas versões. Sem commits ou incompleta (o agente pode ter parado no
   limite) → relançar um agente Haiku com o mesmo escopo (ver o lote B na tabela) a partir de `arquitetura`.
2. `/code-review` no diff `main...arquitetura` do lote B; corrigir achados confirmados.
3. Teste manual (agente Sonnet, docs/TESTING.md): Fp 2:5-8 e 1Rs 15:15 (folha de estudo, palavra hebraica com
   TBESH/"no AT"/RTL, linha do tempo em Atos 16), claro e escuro; conferir as capturas.
4. Lote C (`arq/ciclos`: passos 8 e 9 da revisão), depois D (10, 11) e E (15, index.ts das features, zerar
   exceções), cada um com revisão e, ao fim de D e E, teste manual.
5. Final: `git merge main` em `arquitetura`, `npm run check`, merge `--no-ff` na `main` local, push da `main`.
