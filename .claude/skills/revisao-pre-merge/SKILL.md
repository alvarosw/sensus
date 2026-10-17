---
name: revisao-pre-merge
description: Checklist obrigatório antes de juntar uma branch do Sensus na main — npm run check, teste de arquitetura, /code-review no diff, teste manual com capturas e regras de commit. Use quando uma feature ou correção estiver pronta para merge, ou ao revisar o trabalho de outro agente.
---

# Revisão antes do merge

Faça todos os itens; registre o resultado de cada um no relatório ou na descrição do merge.

1. **Atualize com a main**: `git merge main` (ou rebase, se a branch for só sua) e resolva conflitos.
2. **Checagem automática**: `npm run check` passa (typecheck do núcleo e do app, todos os testes, arquitetura).
   - Nenhuma linha nova em `tests/architecture-exceptions.ts`. Exceções resolvidas foram apagadas.
3. **Revisão de código**: rode `/code-review` sobre o diff da branch contra a `main` (nível médio ou mais para
   mudanças de domínio). Corrija os achados confirmados; registre os descartados e o motivo.
4. **Regras de domínio** (leitura rápida do diff):
   - nenhuma decisão de língua/testamento/Strong/léxico/fonte fora de `packages/core/src/domain`;
   - regra nova tem teste com NT grego e AT hebraico;
   - nenhum import de arquivo interno de outra feature; nenhuma camada de baixo importando `features/`.
5. **Teste manual** (mudança visível): capturas seguindo `docs/TESTING.md`, claro e escuro, NT e AT quando couber.
   Confira as imagens, não só o fato de terem sido geradas.
6. **Commits**: mensagens em português, sem `Co-Authored-By` nem crédito a IA. Nada de `data/`, `*.db`, `.env` ou
   capturas no commit.
7. **Merge**: `git merge --no-ff <branch>` na `main` local só depois dos itens 1–6. Push só com pedido explícito do
   responsável.
