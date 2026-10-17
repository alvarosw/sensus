# Sensus — instruções para agentes

App de estudo bíblico (Expo/React Native, pt-BR) com núcleo TypeScript (`packages/core`) e pipeline Python
(`pipeline/`). Visão geral e comandos em [README.md](README.md).

## Antes de escrever código

- Leia [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). As regras de camadas e de domínio são verificadas por
  `tests/architecture.test.ts`.
- Feature nova ou mudança grande: siga a skill `nova-feature` (`.claude/skills/nova-feature/SKILL.md`).
- Fonte de dados nova: skill `nova-fonte`.
- Antes de propor merge na `main`: skill `revisao-pre-merge` (inclui `/code-review`).
- App Expo: leia `app/AGENTS.md` (APIs do Expo mudam a cada SDK).

## Regras curtas

- Língua, testamento, Strong, léxico, vid de introdução, nomes de fontes e tradições: **só** pelo domínio em
  `packages/core/src/domain` (veja a tabela em ARCHITECTURE.md §2). Nunca `startsWith('H')`, `'gnt'`, `% 1000`,
  `'stepbible-…'` ou "no NT" numa feature.
- Regra nova = função pura com teste, com caso de NT grego **e** AT hebraico.
- Uma feature usa outra só pelo `index.ts` dela; camadas de baixo nunca importam `features/`.
- Textos de UI e documentação em pt-BR; comentários de código em português, no estilo do arquivo vizinho.
- Nada gerado por IA é gravado no aparelho.
- Commits em português, **sem** linha `Co-Authored-By` e sem qualquer crédito a IA.

## Verificação

```bash
npm run check        # typecheck do núcleo e do app + testes TS (inclui arquitetura) + testes do pipeline
npm run test:arch    # só o teste de arquitetura
```

Teste visual e emulador: [docs/TESTING.md](docs/TESTING.md).
