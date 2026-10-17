# Arquitetura do Sensus

Regras que valem para todo código novo. O diagnóstico que as motivou está em
[ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md); o processo para criar features está em
[`.claude/skills/nova-feature`](../.claude/skills/nova-feature/SKILL.md).

O teste [`tests/architecture.test.ts`](../tests/architecture.test.ts) verifica as regras de dependência e de literais
de domínio. `npm run check` roda tudo (typecheck do núcleo e do app, testes, arquitetura) e precisa passar antes de
qualquer merge na `main`.

## 1. Camadas

```
pipeline/                       Python. Gera o banco. Contrato: pipeline/schema.sql (+ schema_physical.sql).
packages/core/src/domain/       Domínio puro: língua, testamento, Strong, léxico, palavra, versículo, fontes.
                                Não importa nada do resto do núcleo além de types.ts e refs.ts.
packages/core/src/              Regras e consultas (Repo, painel, IA, linha do tempo). Usa domain/.
app/src/design, app/src/ui      Tokens e componentes visuais. Não conhecem o domínio nem features.
app/src/i18n                    Locale.
app/src/data                    Banco, download, consultas em cache. Usa core, design/ui.
app/src/{translate,settings,state,ai,auth}
                                Serviços do app. Usam core, data, design/ui. Nunca features.
app/src/features/common         Peças compartilhadas entre features (sem regra de domínio própria).
app/src/features/<feature>      Uma feature. Usa tudo acima. Outra feature só pelo index.ts dela.
app/src/app                     Rotas (Expo Router). Só compõe features.
```

Regras de dependência (verificadas pelo teste de arquitetura):

1. **Para baixo, nunca para cima.** Nenhuma camada importa de uma camada listada abaixo dela. Em especial: nada fora
   de `features/` e `app/` importa de `features/`.
2. **Sem ciclos entre features.** Se duas features precisam da mesma coisa, ela desce para `features/common`,
   `ui/` ou para o núcleo.
3. **Feature pública só pelo `index.ts`.** Uma feature importa outra apenas por `@/features/<outra>` (o
   `index.ts`), nunca por um arquivo interno dela.
4. **O núcleo não conhece o app.** `packages/core` não importa React, Expo nem nada de `app/`.

## 2. Domínio único (`packages/core/src/domain`)

Toda decisão abaixo tem **um** dono. Feature nenhuma reimplementa:

| Pergunta | Quem responde |
|---|---|
| De que língua é esta palavra? (grego, hebraico, aramaico) | `langOfToken`, `wordFacts` |
| De que testamento é este livro/versículo/Strong? | `testamentOfBook`, `testamentOfVid`, `testamentOfStrong` |
| Como ler um Strong (`H0935P` → base, prefixo, sufixo)? | `parseStrong` |
| Qual léxico usar e qual verbete? | `pickLexicon`, `LEXICONS` |
| Esta palavra é de conteúdo? É verbo? É nome próprio? | `isContentToken`, `isVerbToken`, `isProperNameToken` |
| Este vid é introdução (versículo 0)? | `isIntroVid`, `isIntroCommentary` |
| Como se chama esta fonte? Qual a tradição dela? | registro de fontes (`SOURCES`, `TRADITIONS`, `sourceShort`, `traditionLabel`) |
| Que texto original mostrar neste testamento? | `CORPUS[corpus].interlinearText` |
| Em que escrita está esta palavra? | `scriptOf`, `SCRIPT_WORD_RE` |

**Literais de domínio proibidos fora de `domain/` e `repo/`** (o teste de arquitetura procura): `startsWith('H')` /
`startsWith('G')` em Strong, `'gnt'`/`'hot'` como decisão, `% 1000` e `* 1_000_000` em vid, `'stepbible-…'`,
`'tbesg'`/`'tbesh'`, `'no NT'`/`'no AT'` montados à mão. Strings recebem tipos de domínio (`Testament`, `Lang`), nunca
booleanos como `ot: boolean`.

## 3. Features

Cada feature em `app/src/features/<nome>/`:

```
index.ts            API pública (o que outras features e rotas podem usar)
<nome>-model.ts     regras puras da feature (sem React, sem banco), com <nome>-model.test.ts
<Tela>.tsx          componentes; só compõem dados e modelo
strings.ts          textos pt-BR
```

1. **Modelo puro + teste antes da tela.** Exemplos a seguir: `timeline/model.ts`, `timeline/parallel-lanes.ts`,
   `study/thread.ts`.
2. **Dois testamentos nos testes.** Regra que toca token, léxico, concordância ou morfologia tem caso de NT grego e de
   AT hebraico (e aramaico quando usa morfologia). Fixtures prontas no núcleo: Fp 2:5-8, 1Rs 15:15, Dn 2:4.
3. **Arquivo de tela até ~300 linhas.** Acima disso, separar subcomponentes e modelo.
4. **Estado**: o store de cada feature fica na feature. `useStudy` só guarda o que é compartilhado entre leitor,
   folha e chat.
5. **Tradução automática**: decidir se um texto é traduzível pelo núcleo (`isTranslatableSource`), nunca por
   suposição sobre a fonte.
6. **Fonte de dados nova**: ingestor + entrada no registro de fontes + linha em `DATA_LICENSES.md`
   (skill `nova-fonte`). O teste do registro falha se faltar rótulo ou tradição.

## 4. Contrato pipeline × núcleo

- `pipeline/schema.sql` é o contrato lógico; `schema_physical.sql` é o que o app lê. Os testes do núcleo carregam os
  dois.
- `strong_base` é calculado por uma função só no pipeline (`sensus/strong.py`), com a mesma regra de `parseStrong`.
- A tabela de livros existe no Python e no TypeScript; um teste de paridade compara as duas.

## 5. Mapa do código

| Onde | O que mora ali |
|---|---|
| `packages/core/src/domain/` | `language` (Lang, Corpus, Testament, `CORPUS`, original por testamento, legenda das edições), `strong`, `lexicon` (`LEXICONS`, `pickLexicon`), `morph` (conteúdo, verbo, nome próprio por língua), `vid` (aritmética de vid), `script` (escrita e direção), `word` (`wordFacts`), `sources` (registro de fontes e tradições, idioma traduzível) |
| `packages/core/src/repo/` | consultas ao banco por área (`text`, `language`, `commentary`, `dictionary`, `entities`, `timeline*`, `cite`); `Repo` é a fachada |
| `packages/core/src/` | painel (`panel.ts`), IA (`ai/`), linha do tempo e combinações (`timeline*.ts`), tradução (segmentos e lotes) |
| `app/src/ui/` | componentes sem domínio (inclui `Buttons`) |
| `app/src/data/` | banco, download, fila serial de consultas, fontes carregadas |
| `app/src/state/study/` | store compartilhado em slices (`reader`, `selection`, `sheet`, `lenses`, `generations`, `panels`, `chat`, `toast`); `state/reader-nav.ts` |
| `app/src/translate/` | `useTranslatable` (política `item` ou `global`), motor e cache em memória |
| `app/src/features/<f>/index.ts` | API pública de `reader` (inclui a navegação), `study`, `timeline`, `maps`, `rich` |
| `app/src/features/study/` | folha (`StudySheet`, `PeekContent` + `peek-model`, `Rail`), lentes (`lenses/` + `lens-model`), cards (`cards/`), fio (`thread`, `keyword`), dados e IA (`useStudyData`, `useStudyAi`) |

## 6. Qualidade antes do merge

1. `npm run check` (typecheck do núcleo e do app, testes, arquitetura).
2. Revisão de código com `/code-review` no diff da branch.
3. Mudança visível: teste manual com capturas (claro e escuro), seguindo [TESTING.md](TESTING.md).
4. Commits em português, sem linha de coautoria nem crédito a IA.

Exceções existentes às regras ficam listadas em `tests/architecture-exceptions.ts`, cada uma com o passo que vai
removê-la. A lista só diminui: o teste falha se alguém acrescentar uma violação nova.
