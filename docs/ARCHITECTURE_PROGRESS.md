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
| A | 1 domínio · 2 fixtures AT · 7 dividir repo · 13 contrato físico/pipeline · 5 registro de fontes | `arq/dominio`, `arq/fixtures-at`, `arq/repo-split`, `arq/contrato`, `arq/fontes` | pendente |
| B | 3 migrar língua/testamento/léxico · 4 `isContentToken` por língua | `arq/migrar-dominio` | depois de A |
| C | 8 desfazer ciclos e camadas · 9 formatadores únicos · 12 tradução unificada | `arq/ciclos`, `arq/traducao` | depois de B |
| D | 10 dividir lentes e prévia · 11 texto original por testamento (WLC no AT) | `arq/lentes`, `arq/original-at` | depois de C |
| E | 15 fatiar `useStudy` · índices públicos das features · zerar exceções | `arq/estado` | por último |
| T | Teste manual (Sonnet) após B, D e E; merge na `main` | — | — |

Passo 14 (registro no contrato do banco) fica fora: exige rebuild e release de dados; o registro no núcleo (passo 5)
com teste cobre o risco. Reavaliar depois.

## Registro

- 2026-10-16 23:40 — Lote 0 pronto (78 exceções iniciais no teste de arquitetura).
