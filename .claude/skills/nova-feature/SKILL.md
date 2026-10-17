---
name: nova-feature
description: Processo para criar ou mudar uma feature do Sensus sem quebrar a arquitetura — modelo puro testado primeiro, domínio do núcleo, camadas, testes nos dois testamentos, checagem e revisão. Use ao começar qualquer feature nova, tela nova ou mudança de comportamento no app ou no núcleo.
---

# Nova feature no Sensus

Siga na ordem. Cada passo tem um critério de pronto.

## 1. Entender e localizar

- Leia `docs/ARCHITECTURE.md` (camadas, domínio, convenções) e o `index.ts` das features que vai tocar.
- Decida **onde mora cada parte**:
  - regra de domínio (língua, testamento, Strong, léxico, fontes, vid) → `packages/core/src/domain/` (já existe? use;
    falta? acrescente lá, com teste);
  - consulta ao banco → `packages/core/src/repo/`;
  - regra da feature, pura → `app/src/features/<feature>/<nome>-model.ts`;
  - tela → componentes da feature, que só compõem dados e modelo.
- Se a feature precisa de algo de outra feature, use o `index.ts` dela. Se não estiver exportado e for de uso geral,
  mova para `features/common`, `ui/` ou para o núcleo — nunca importe um arquivo interno de outra feature.

Pronto: você sabe em que arquivos vai mexer e nenhum deles quebra uma regra de camada.

## 2. Modelo puro primeiro

- Escreva as regras como funções puras (sem React, sem banco, sem `Date.now()` escondido).
- Teste com vitest no mesmo diretório (`<nome>-model.test.ts`).
- Casos obrigatórios quando a regra toca token, léxico, concordância ou morfologia: NT grego (Fp 2:5-8) **e** AT
  hebraico (1Rs 15:15); aramaico (Dn 2:4) se usa morfologia. Use as fixtures do núcleo.

Pronto: `npx vitest run <arquivo>` passa.

## 3. Tela

- Componentes até ~300 linhas; acima disso, separe.
- Só tokens e componentes de `app/src/design` e `app/src/ui` (`docs/DESIGN_SYSTEM.md`); claro e escuro.
- Textos em `strings.ts` da feature, em pt-BR; strings que dependem de testamento/língua recebem `Testament`/`Lang`.
- Estado: no store da própria feature; `useStudy` só se for compartilhado entre leitor, folha e chat.
- Texto em inglês vindo de fonte: tradução automática pelo mecanismo do app, decidindo por `isTranslatableSource`.

## 4. Verificar

```bash
npm run check
```

- Se o teste de arquitetura acusar violação, corrija o código. Não acrescente nada em
  `tests/architecture-exceptions.ts` (a lista só diminui; se você resolveu uma exceção, apague-a).
- Mudança visível: capturas seguindo `docs/TESTING.md` (claro e escuro; NT e AT quando couber).

## 5. Revisar e entregar

- Siga a skill `revisao-pre-merge` (inclui `/code-review` no diff).
- Commits pequenos, em português, sem `Co-Authored-By` nem crédito a IA. Sem push sem pedido.
