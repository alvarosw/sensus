# Revisão de arquitetura: modularidade e escalabilidade das features

Base: `main` na versão 1.1.0 (commit `1741f0e`). Branches pendentes consideradas: `ai/novas-fontes-021ed6`
(novas fontes de comentário, com 4 tradições novas em `app/src/features/study/format.ts`) e `painel-palavra`
(correções pontuais do painel da palavra, ainda sem commits quando esta revisão foi feita). Esta revisão **não altera
código de produção**: só registra o diagnóstico e propõe os passos.

Os números de linha valem para a `main` em 1.1.0. Os dados citados vêm de `data/sensus.db` (banco completo local).

---

## 0. Resumo

O sintoma relatado (painel de uma palavra hebraica em 1Rs 15:15 com "Léxico · TBESG", "Sem ocorrências no
texto-base" e "2308 versículos no NT") não é um bug isolado. O NT grego entrou primeiro, e o app e o núcleo foram
feitos assumindo grego e NT. O AT hebraico (TAHOT/TBESH) entrou depois pelo pipeline, mas **o modelo de domínio não
ganhou o conceito de língua**. Cada tela decide "grego ou hebraico?", "NT ou AT?" e "qual léxico?" por conta própria,
com heurísticas diferentes (`startsWith('H')`, `corpus === 'gnt'`, `book >= 40`, `source_id.includes('tbesg')`,
texto fixo "no NT"). Quando alguém corrige uma tela, as outras continuam erradas.

O mesmo acontece, em menor grau, com o **registro de fontes**: nomes curtos, comentaristas, rótulos de tradição e
fontes de texto do leitor estão em 6 tabelas espalhadas entre o núcleo e o app. Uma fonte nova (como as de
`ai/novas-fontes-021ed6`) obriga a mexer em vários lugares, e nada avisa quando falta um.

### Os 5 achados mais graves

| # | Achado | Efeito hoje | Onde |
|---|---|---|---|
| 1 | **Não existe conceito de língua.** Grego/hebraico/aramaico é deduzido de 4 sinais diferentes (prefixo do Strong, `corpus`, número do livro, faixa Unicode). O aramaico (4 827 tokens com morfologia `A…`) não existe para o app. | Rótulos errados ("TBESG", "no NT") em palavra hebraica; fonte "grega" (`fontFamilies.greek`) usada para hebraico; trilha do painel marcada `greek: true` para qualquer lema. | §1.1, §1.2 |
| 2 | **A escolha do léxico está fixa no grego e duplicada com regras divergentes.** `pickLexicon` só procura `stepbible-tbesg`/`stepbible-tflsj`; `lexiconByBase` prefere `tbesg` e senão pega o primeiro verbete do `strong_base`, ignorando o sufixo do Strong. | Palavra hebraica fica sem verbete no painel (mostra "Sem ocorrências no texto-base", a mensagem errada). No estudo, H0935P (sentido "P") recebe o verbete H0935G: o card e o painel mostram sentidos diferentes da mesma palavra. | §1.4 |
| 3 | **`isContentToken` só conhece a morfologia Robinson (grego).** Códigos hebraicos (`HTo`, `HR/Ncfsa`, `HC/…`) nunca casam com `FUNCTION_POS`, então todo token hebraico conta como "palavra de conteúdo". | No AT, a palavra-chave, os hápax, a lente Língua e a camada 4 do contexto da IA incluem partícula de objeto, preposições e conjunções. | §1.3 |
| 4 | **Registro de fontes e tradições espalhado por 6 tabelas** (núcleo e app), sem verificação. `sword-kd` (tradição `lutheran`) já está no banco sem rótulo nem nome curto na `main`; a branch de novas fontes adiciona tradições só no app. | Cada fonte nova é uma caça a constantes; rótulos crus ("lutheran") e nomes automáticos aparecem sem ninguém notar. | §1.6 |
| 5 | **Os testes cobrem quase só o NT grego, e só o esquema lógico.** As fixtures do núcleo são de Filipenses; nenhum teste exercita token hebraico, TBESH, Strong com sufixo ou aramaico. O app roda sobre o esquema físico (`schema_physical.sql`, com views), que nenhum teste carrega. Não há lint de imports, typecheck do app no script raiz nem CI. | Os bugs do item 1 passaram por todos os testes. Mudanças de contrato no pipeline só aparecem no aparelho. | §2.7 |

Outros achados relevantes: ciclos de dependência entre features (§2.2); `study/format.ts` virou utilitário
compartilhado por 4 features; 5 formatadores de referência curta e 2 tradutores de morfologia (§2.2); arquivos grandes
com responsabilidades misturadas (§2.3); duas políticas de tradução automática com a decisão de idioma em lugares
diferentes (§2.6).

---

## 1. Conceitos de domínio decididos em vários lugares

### 1.1 Língua e corpus (grego × hebraico × aramaico)

O banco tem `token.corpus ∈ {'gnt','hot'}` (`pipeline/schema.sql:74`) e `source.lang` (`'grc'`, `'hbo'`). O
aramaico não tem representação: `tahot` é `lang='hbo'`, e a única marca está no prefixo da morfologia (`A…` em 4 827
tokens, `H…` em 300 807). O `strong` de um token aramaico também começa com `H`.

| Decisão | Arquivo:linha | Regra usada | Problema |
|---|---|---|---|
| Corpus do token | `pipeline/ingest/tagnt.py:478`, `pipeline/ingest/tahot.py:384-385` | fixo por ingestor | ok (é a fonte da verdade) |
| Corpus no layout físico | `pipeline/schema_physical.sql:40,59,114,116,144` | `0=gnt`, `1=hot` repetido em 5 `CASE` | duplicação em SQL; um terceiro corpus exige 5 edições |
| Tipo TS | `packages/core/src/types.ts:64` | `'gnt' \| 'hot'` | sem tipo de língua |
| Variantes só no grego | `packages/core/src/panel.ts:99`, `packages/core/src/variants.ts:69` | `corpus === 'gnt'` | ok, mas a regra "edições comparáveis" fica implícita |
| Texto-base no contexto da IA | `packages/core/src/ai/context.ts:150,153,256` | `corpus === 'gnt'` / `=== 'hot'` | regra "TR no NT, tudo no AT" reimplementada 3 vezes |
| Palavra-chave | `app/src/features/study/format.ts:157-160` | `corpus !== 'gnt' \|\| /\b(TR\|NA)\b/` | **diverge** do núcleo: aqui vale TR **ou NA**; no contexto da IA, só TR. Regex no lugar de `hasEdition` |
| Grego TR no leitor | `app/src/features/reader/Reader.tsx:496` | `tokens(…, 'gnt')` + `hasEdition('TR')` | AT não tem interlinear (o `hbo-wlc` existe no banco e é ignorado pelo app) |
| Comparar texto (lente Texto) | `app/src/features/study/lenses.tsx:183,256-257` | `corpus !== 'gnt'` descarta; opção fixa "Grego TR" | no AT a opção "Grego TR" mostra vazio |
| Língua de palavra em texto da IA | `packages/core/src/ai/rich-text.ts:16,108` | faixa Unicode hebraica → `'hbo'`, senão `'grc'` | aramaico vira `hbo`; regra por script, não por token |
| Detecção de script | `packages/core/src/ai/rich-text.ts:15`, `app/src/features/rich/ScriptText.tsx:6`, `app/src/features/common/GreekText.tsx:4`, `packages/core/src/translate-segments.ts:13` | 3 regex com faixas literais + 1 com `\p{Script}` | 4 cópias da mesma regex |
| Rótulo sem prefixo grego | `app/src/features/rich/RichBlocks.tsx:341` | `(?=\p{Script=Greek})` | **só grego**: rótulo hebraico não é limpo |
| Fonte tipográfica | `app/src/design/tokens.ts:116,128`; `app/src/features/sources/WordPanel.tsx:115,122,146` | `fontFamilies.greek` para tudo | nome engana; sem direção RTL em lugar nenhum (`writingDirection` não aparece no app) |
| Trilha de painéis | `app/src/features/sources/PanelStack.tsx:113,117` | `greek: true` fixo para `word` e `lemma` | não é por língua |
| Fonte de licença do token | `app/src/features/sources/WordPanel.tsx:98` | `'TAGNT'` fixo | palavra do AT aparece como TAGNT |

### 1.2 Testamento (NT × AT)

`book.testament` existe no banco (`pipeline/schema.sql:47`) e em `BOOK_TABLE` (`packages/core/src/refs.ts:84-89`),
mas quase nenhuma feature o consulta. Cada uma deduz o testamento de outro dado.

| Arquivo:linha | Regra | Observação |
|---|---|---|
| `packages/core/src/repo.ts:34,312` | `book >= FIRST_NT_BOOK (40)` → `tagnt`, senão `tahot` | constante privada; mapeia testamento → fonte de parágrafos |
| `app/src/features/study/format.ts:184-186` | `isOldTestament(strongBase) = strongBase.startsWith('H')` | testamento deduzido do prefixo do Strong. Nome engana: é a língua, não o testamento |
| `app/src/features/study/StudySheet.tsx:556` | `strongBase.startsWith('H')` **duas vezes, inline** | reimplementa `isOldTestament` sem usá-lo |
| `app/src/features/study/cards.tsx:60,82` | `isOldTestament` + string montada à mão `` `… no ${ot ? 'AT' : 'NT'}` `` | duplica `STUDY.factVv` com outro formato ("versículo"/"vv.") |
| `app/src/features/study/thread.ts:143` | `isOldTestament(sb)` | ok, mas depende da heurística |
| `app/src/features/study/strings.ts:19-21` | `factHapax` / `factHapaxOt` / `factVv(n, ot)` | o testamento vira booleano solto no texto |
| `app/src/features/common/strings.ts:70` | `concordance: n => '… versículos no NT'` | **fixo "NT"**: é a origem do "2308 versículos no NT" (2 308 é a contagem certa de H0935 no AT) |
| `app/src/features/common/cites.ts:233` | comentário "Total de versículos com a palavra no NT" | a premissa errada está documentada |
| `app/src/features/study/keyword.ts:42,168` | comentários "NT/AT" | ok |
| `app/src/features/nav/categories.ts:7-22`, `app/src/features/nav/BookPicker.tsx:13,39` | tipo local `'OT' \| 'NT'`, redeclarado | `Book['testament']` já existe no núcleo |
| `pipeline/ingest/sword_common.py:177-216` | `"ot"`/`"nt"` do SWORD | interno ao ingestor, ok |

Há também uma inconsistência de premissa: o **contador** de concordância (`repo.ts:386`) soma os dois corpora pelo
`strong_base` (o que só funciona porque G e H não colidem), enquanto as **amostras** vêm de `DEFAULT_TEXT_SOURCE`
(`blivre`, `repo.ts:29`). Nada garante que a fonte de texto cubra o testamento da palavra.

### 1.3 Morfologia e "palavra de conteúdo"

| Arquivo:linha | Regra | Problema |
|---|---|---|
| `packages/core/src/morph.ts:5-28` | `FUNCTION_POS` Robinson; `morph.split('-')[0]` | hebraico (`HTo`, `HC/Ncmsa`, `HR/…`) nunca casa: **todo token hebraico é "de conteúdo"** |
| `app/src/features/study/keyword.ts:75` | verbo: `/^Verb/` em `morph_desc` **ou** `/^(?:H?V)(?:-\|[a-z])/` em `morph` | já trata o hebraico, mas por fora de `morph.ts` |
| `app/src/features/study/keyword.ts:79-84` | nome próprio só por `Name type=` (TAGNT) | no AT nunca há exclusão de nomes; o próprio comentário admite |
| `packages/core/src/ai/morphcheck.ts` | categorias do TEGMC (grego) | o verificador da IA não conhece o TEHMC |
| `app/src/features/common/morph-pt.ts` e `app/src/features/study/format.ts:62-103` | **dois** dicionários inglês → português de termos gramaticais (`ATOMS` e `MORPH_PT`) com capitalização e cobertura diferentes | o painel e o card mostram a mesma morfologia com palavras diferentes |

### 1.4 Strong: base, sufixos estendidos e normalização

Formato no contrato: `strong = 'G'|'H' + 4 dígitos + sufixo`; `strong_base` = sem sufixo (`pipeline/schema.sql:18-19`).
Exemplo real em 1Rs 15:15: `strong='H0935P'`, `strong_base='H0935'`. O TBESH tem `H0935G … H0935P` (10 verbetes) para
a mesma base.

| Arquivo:linha | Regra | Problema |
|---|---|---|
| `pipeline/ingest/tagnt.py:331,353-354` | `strong[:5]` | corte por posição |
| `pipeline/ingest/tahot.py:225` | `strong[:5]` | igual |
| `pipeline/ingest/stepbible_common.py:86-87` | `re.match(r"[GH]\d+", key)` | **regra diferente**: com 5 dígitos daria `G12345`, e os tokens dariam `G1234`. Hoje todo `strong_base` do léxico tem 5 caracteres, então a divergência é latente |
| `app/src/features/common/cites.ts:223-228` (`pickLexicon`) | verbete com `key === strong`; senão o primeiro; **só `stepbible-tbesg` e `stepbible-tflsj`** | hebraico → `tbesg: null`. O painel cai no `Empty` de `WordPanel.tsx:164`, que reaproveita `SRC.noOccurrences` ("Sem ocorrências no texto-base") |
| `app/src/features/study/format.ts:145-153` (`lexiconByBase`) | por `strong_base`; prefere `source_id.includes('tbesg')`; **ignora o sufixo** | H0935P recebe o primeiro verbete (H0935G). Diverge de `pickLexicon` |
| `app/src/features/sources/WordPanel.tsx:141` | rótulo `` `${SRC.lexicon} · TBESG` `` fixo | origem do "Léxico · TBESG" no hebraico |
| `app/src/features/sources/WordPanel.tsx:92`, `SourcePopover.tsx:214-216` | `pickLexicon` | herdam o problema |
| `packages/core/src/ai/context.ts:41` | `LONG_LEXICON_SOURCES = {'stepbible-tflsj'}` | regra de léxico longo por id literal |
| `packages/core/src/ai/cite-index.ts:22-37` | nome curto `stepbible-tbesg → 'TBESG'`; **sem `stepbible-tbesh`** | o TBESH cai no título automático |

### 1.5 Versificação e `vid`

`vid = livro*1_000_000 + capítulo*1000 + versículo`. O núcleo tem `splitVid`/`makeVid` (`packages/core/src/refs.ts:113-117`),
espelhando `pipeline/sensus/refs.py:112`. O "versículo 0" (introdução de capítulo ou livro) é testado por aritmética
crua em muitos lugares:

| Arquivo:linha | Uso |
|---|---|
| `app/src/features/study/format.ts:128` | `start_vid % 1000 === 0 \|\| end_vid % 1000 === 0` (comentário de introdução) |
| `app/src/features/study/thread.ts:198` | o mesmo filtro, negado |
| `app/src/features/study/StudySheet.tsx:509` | o mesmo filtro, negado (3ª cópia) |
| `app/src/features/study/lenses.tsx:650,677` | `% 1000 === 0` |
| `app/src/features/study/StudySheet.tsx:467-471` | `unitStartOf`: `v + 1001` / `v + 1` (aritmética de vid no componente) |
| `app/src/features/common/cites.ts:141` | `splitVid(...).verse === 0` (mesma regra, outra forma) |
| `packages/core/src/ai/rich-text.ts:56` | `verse.vid % 1000` |
| `packages/core/src/repo.ts:239-240,285-286,329-330` | `book * 1_000_000` repetido 3 vezes |
| `app/src/features/maps/usePlaceSites.ts:9` | `WHOLE_BIBLE` com vids literais |
| `pipeline/ingest/{tahot,gill,sword_tsk,sword_commentaries}.py` | `v % 1000 == 0` |

Formatação de referência curta, **5 implementações**: `formatShortRef` (`packages/core/src/ai/cite-index.ts:95`),
`refShort` (`app/src/features/study/format.ts:37-40`), `shortRef`/`rangeLabel` (`app/src/features/common/format.ts:3-11`),
`shortRef(range)` com regras próprias de capítulo inteiro (`app/src/features/nav/abbrev.ts:65-77`) e `chv`
(`study/format.ts:18-22`). A timeline importa `refShort` de `study/format`.

A tabela de livros existe em dois lugares (`pipeline/sensus/refs.py:6` e `packages/core/src/refs.ts:13`, "espelha"),
sem teste de paridade.

### 1.6 Rótulos de fonte, comentarista e tradição

| Tabela | Arquivo:linha | Conteúdo | Sobreposição |
|---|---|---|---|
| `SOURCE_SHORT` | `packages/core/src/ai/cite-index.ts:22-37` | texto, léxico, dicionários, xref | — |
| `COMMENTATOR_SHORT` | `packages/core/src/ai/cite-index.ts:40-50` | 9 comentários | falta `sword-kd`, que já está no banco |
| `SHORT_SOURCE` | `app/src/features/common/cites.ts:43` | `blivre`, `kjv`, `grc-tr` | subconjunto de `SOURCE_SHORT` |
| `SOURCE_SHORT` | `app/src/features/study/lenses.tsx:65-77` | dicionários, entidades, xref | sobrepõe a do núcleo, com `theographic`/`tipnr`/`openbible-geo` a mais |
| `TRADITION_PT` | `app/src/features/study/format.ts:46-59` | rótulos pt das tradições | falta `lutheran` (`sword-kd`); `ai/novas-fontes-021ed6` adiciona `adventist`, `catholic`, `lutheran`, `anglican` só aqui |
| `sourceLabel` | `app/src/features/study/format.ts:42-44` | `kjv ? 'KJV' : 'Bíblia Livre'` | 4ª tabela de nomes de texto |
| `SOURCE_LABEL` | `app/src/features/reader/strings.ts:36` | curto/longo do leitor | 5ª |
| tradição no contexto | `packages/core/src/ai/context.ts:345` | valor cru (`reformed`) | a IA vê o id em inglês, a UI vê o rótulo pt |
| `commentatorName` / patrística | `packages/core/src/ai/cite-index.ts:117-130`, `app/src/features/study/format.ts:115` | `source_id === 'patristic'` | regra da patrística em 2 lugares |

Os valores de `tradition` nascem no pipeline (`pipeline/ingest/sword_commentaries.py:27-33`, `gill.py:68`,
`patristic.py:346`), sem enumeração no contrato (`schema.sql:39` só dá exemplos).

### 1.7 Fontes de texto (leitor e comparação)

| Arquivo:linha | Regra |
|---|---|
| `packages/core/src/repo.ts:29` | `DEFAULT_TEXT_SOURCE = 'blivre'` |
| `app/src/settings/app-prefs.ts:15-16,25` | `TEXT_SOURCES = ['blivre','kjv']` |
| `app/src/state/study.ts:91,111,186` | `textSource: string` + `compare: 'blivre' \| 'kjv' \| 'tr'` |
| `app/src/features/study/useStudyData.tsx:113` | `textSource === 'kjv' ? 'kjv' : 'blivre'` |
| `app/src/features/nav/TopBar.tsx:27` | alterna `blivre ↔ kjv` |
| `app/src/features/study/lenses.tsx:256-257,333` | opções fixas; `source_id === 'blivre'` |
| `pipeline/build_db.py:44` | `READER_TEXT_SOURCES = ("blivre","kjv","grc-tr","hbo-wlc")` |

O pipeline publica `hbo-wlc`, mas o app não o conhece: no AT, a comparação "original" não existe.

### 1.8 Edições (TR / BYZ / NA e as do AT)

| Arquivo:linha | Regra |
|---|---|
| `packages/core/src/panel.ts:8-22` | `BASE_EDITIONS`, `editionSet`, `hasEdition`, `missingBaseEditions` (fonte única no núcleo) |
| `app/src/features/study/format.ts:159` | regex `/\b(TR\|NA)\b/` em vez de `hasEdition` |
| `packages/core/src/ai/prompts.ts:74,143` | "Texto-base: TR" (vale só para o NT) |
| `app/src/design/components.tsx:306-314` | `EditionBadge`: destaque só para `TR` |
| dados do AT | `editions` = `L` (304 073), `Q` (1 323), `X`, `R`, `L,A`, `L,B`… | o app mostra as siglas cruas, sem legenda; a regra "palavra-chave" conta Ketiv e Qere juntos (sem dedupe) |

O código de edição está no núcleo, mas **por corpus** ele não tem significado: `BASE_EDITIONS` vale só para `gnt`, e
o AT não tem uma edição-base declarada (`L` = Leningrado).

### 1.9 Formato do `cite_id`

Definido em `pipeline/schema.sql:10-17`, gerado em `pipeline/sensus/staging.py:42`, derivado de novo em SQL
(`pipeline/schema_physical.sql:114`) e lido por regex em `packages/core/src/repo.ts:687,696,718`. Três implementações
de `tok:{corpus}:{vid}:{pos}`. A regex do núcleo (`(?:gnt|hot)`) também precisaria mudar com um corpus novo.

---

## 2. Fronteiras

### 2.1 O que está no app e deveria estar no núcleo (lógica pura de domínio)

| Hoje no app | Por que é domínio | Destino |
|---|---|---|
| `isOldTestament`, `isKeyToken`, `lexiconByBase`, `keyWordsOf` (`study/format.ts:132-186`) | regras sobre token, léxico e concordância, sem React | `core/domain` (língua/Strong) e `core/language.ts` (palavras-chave) |
| `pickLexicon`, `LexiconPair` (`common/cites.ts:217-229`) | escolha de verbete por língua e sufixo | `core/domain/lexicon.ts` |
| `TRADITION_PT`, `traditionLabel`, `sourceLabel`, `SOURCE_SHORT` do app | registro de fontes | `core/sources.ts` (ou colunas no banco, §3.3) |
| `MORPH_PT` (`study/format.ts`) e `ATOMS` (`common/morph-pt.ts`) | tradução de termos gramaticais | `core/morph-pt.ts` (um só) |
| `viewCommentary` (`study/format.ts:118-130`) | corte do cabeçalho patrístico, introdução | `core` junto de `commentatorName` |
| filtro "comentário de introdução" (3 cópias, §1.5) | regra de vid | `core/refs.ts`: `isIntroVid`, `isIntroCommentary` |
| `facts` da prévia (`StudySheet.tsx:507-516`) | pura (painel → números) | `study/peek-model.ts` com teste, como já foi feito em `thread.ts` |
| `keyword.ts` (199 linhas, puro) | escolha da palavra do passo | pode ficar no app, mas deve usar o domínio do núcleo |

Exemplo positivo: a **linha do tempo** já segue o padrão desejado. O núcleo tem as regras (`packages/core/src/timeline.ts`)
e as consultas (`repo.ts`); o app tem modelos puros testados (`timeline/model.ts`, `context-model.ts`, `combos.ts`,
`parallel-lanes.ts`) e as telas separadas. `study/thread.ts` + `thread.test.ts` também. Esse é o modelo a seguir.

### 2.2 Dependências entre features e camadas

Importações entre features hoje (contagem de `import` por par):

| De → para | Arquivos | Comentário |
|---|---|---|
| `timeline → study` | `ContextView.tsx:7`, `EventPreview.tsx:13`, `LineView.tsx:7` (`refShort`) | **ciclo** com `study → timeline` (`cards.tsx:38`, `EventPreview`) |
| `rich → study` | `RichBlocks.tsx:28` (`morphLabelsPt`, `bareWord`) | **ciclo** com `study → rich` (`Thread.tsx:6`, `LensShell.tsx:15`, `cards.tsx:31`) |
| `sources → study` | `SourcePopover.tsx:23`, `SourcePanel.tsx:10` (`traditionLabel`) | `study/format` usado como biblioteca |
| `maps ↔ sources` | `MapPanel.tsx:11` → `sources/PanelParts`; `sources/PanelStack.tsx:16-17`, `EntityPanel.tsx:14` → `maps` | **ciclo** |
| `nav ↔ reader` | `TopBar.tsx:8-9`, `JumpPopover.tsx:8-9`, `BookPicker.tsx:8` → `reader`; `Reader.tsx:12-13`, `chapters.ts:4`, `ChapterBlock.tsx:10`, `PinnedBar.tsx:8` → `nav` | **ciclo**; na prática são uma feature só |
| `nav → timeline` | `BookPicker.tsx:9` (`TL` strings) | string emprestada |
| `chat → study` | `useChat.ts:6` (`usePassagePanel`) | aceitável (painel compartilhado), mas deveria estar em `common` ou `data` |
| `study → reader`, `timeline → reader` | `lenses.tsx:33`, `timeline/actions.ts:5` (`nav-store`) | estado de navegação dentro de uma feature |

Camadas inferiores importando features (inversão):

| Arquivo | Importa |
|---|---|
| `app/src/translate/source-lang.ts:4` | `@/features/common/cites` (`loadSources`) |
| `app/src/settings/app-prefs.ts:13` | `@/features/timeline/combos` |
| `app/src/settings/{api-key-section,chatgpt-card,AttentionModal}.tsx`, `app/src/data/{DownloadStatus,StudyDataPrompt}.tsx` | `@/features/common/Buttons` |

Conclusão: `study/format.ts` e `features/common/cites.ts` viraram "utilitários globais" com conhecimento de domínio;
`features/common` tem de tudo (cache de consultas, strings, botões, morfologia). Não há lint de imports
(`eslint` não está instalado; `npx expo lint` não roda) nem verificação de ciclos.

### 2.3 Arquivos grandes

| Arquivo | Linhas | Responsabilidades misturadas | Proposta |
|---|---|---|---|
| `app/src/features/study/lenses.tsx` | 776 | 8 lentes, tabela de fontes, `CompareText`, deduplicação de lugares, filtro de tradição, aritmética de vid | `study/lenses/<Lente>.tsx` (uma por arquivo) + `study/lens-model.ts` puro (seleção, dedupe, filtros) com teste |
| `packages/core/src/repo.ts` | 734 | texto, divisões, unidade literária, tokens/léxico/concordância, comentários, dicionários, entidades, mapa, **10 consultas de linha do tempo**, `resolveCite` | manter a classe `Repo` como fachada e separar em `repo/text.ts`, `repo/language.ts`, `repo/timeline.ts`, `repo/cite.ts` (funções que recebem o driver) |
| `app/src/features/reader/Reader.tsx` | 624 | rolagem, seleção, grego TR, última posição, salto | extrair `useInterlinear` (grego/hebraico por testamento) e `useReaderJump` |
| `app/src/features/study/StudySheet.tsx` | 615 | gesto/detentes, cabeçalho, prévia (fatos + escopo), trilho | `PeekContent` + `peek-model.ts`; `Rail` em arquivo próprio |
| `app/src/features/study/cards.tsx` | 534 | 9 cards + matriz + pílulas | 1 arquivo por família (palavra, comentário, histórico, intertexto) |
| `app/src/features/rich/RichBlocks.tsx` | 553 | blocos ricos, chips de citação, rótulos | separar `CiteChip` e o rótulo (que hoje só limpa o grego) |
| `app/src/features/study/useStudyData.tsx` | 432 | contexto React, bordas do trecho, streaming da IA | separar `useStudyAi` (streaming) de `useStudyData` (painel) |

### 2.4 Contrato pipeline × núcleo

| Ponto | Situação | Risco |
|---|---|---|
| Esquema lógico (`schema.sql`) × tipos (`types.ts`) | mantidos à mão; os testes do núcleo carregam `schema.sql` (`packages/core/test/fixtures.ts:6`) | médio: o app usa o físico |
| Esquema físico (`schema_physical.sql`, views) | **sem teste**; o mapeamento `0/1 ↔ gnt/hot` e o `cite_id` derivado estão só nele | alto: um erro só aparece no aparelho |
| `strong_base` | 3 regras no Python (§1.4); o núcleo confia no valor | baixo hoje, latente |
| `source.lang` / `tradition` | texto livre; o app depende dele para tradução (`lang === 'en'`) e rótulos | médio |
| `BOOK_TABLE` | duplicada em Python e TS | baixo (estável), sem teste de paridade |
| Fontes que o app espera | ids literais em ~40 pontos (`tagnt`, `tahot`, `blivre`, `theographic`, `stepbible-*`, `sword-*`) | médio: renomear uma fonte quebra em silêncio |

### 2.5 Estado global

- `app/src/state/study.ts` (292 linhas) é um store único `useStudy` com leitor, seleção, folha, lentes, gerações de
  IA, painéis, chat, balão e toast; 223 usos no app. O comentário do arquivo (l. 2) já o trata como "contrato entre
  agentes". Funciona, mas toda feature nova acaba pendurando um campo nele (ex.: `tradition`, `compare`, `greek`).
- Há outros 15 stores `zustand` (`reader/nav-store.ts`, `timeline/context-return.ts`, `translate/store.ts`,
  `translate/timeline-translate.ts`, `settings/app-prefs.ts`…). `textSource` existe em `useStudy` **e** em
  `useAppPrefs` (`TopBar.tsx:27` grava em `app-prefs`, que reflete em `study`).
- Caches de consultas ficam em `features/common/cites.ts` (`cacheOf(repo)`, com a fila `serial`), não em `data/`.

Proposta: fatiar `useStudy` em slices por domínio (`reader`, `selection`, `sheet`, `panels`, `chat`), mantendo o hook
de compatibilidade; `compare` vira um id de fonte do registro (§3.3); `tradition` passa a ser tipado pelo registro.
Mover `cacheOf`/`serial`/`loadX` para `app/src/data/queries.ts`.

### 2.6 Tradução automática

| Mecanismo | Arquivo | Política | Decisão de idioma |
|---|---|---|---|
| Por texto (estudo, painéis) | `app/src/translate/useAutoTranslate.ts` | oferta uma vez por sessão, "Ver original" por texto | `lang === 'en'` vindo de `useSourceLang` (`translate/source-lang.ts`, que importa `features/common/cites`) |
| Em lote (linha do tempo) | `app/src/translate/timeline-translate.ts` | ligada/desligada global, "Ver original" global, lote por quadro | **nenhuma**: assume que a theographic é inglês (comentário l. 5) |
| Motor e cache | `app/src/translate/engine.ts` | cache LRU em memória, compartilhado | `segmentForTranslation` do núcleo separa grego/hebraico |
| Puro | `packages/core/src/translate-segments.ts`, `translate-batch.ts` | segmentação, lotes, busca | ok, testado |
| Link Google | `packages/core/src/translate.ts` | URLs | ok |

São duas APIs de hook com o mesmo motor, e a regra "esta fonte é traduzível?" fica fora do módulo de tradução (num
caso, na feature `common`; no outro, num comentário). Proposta: uma função `isTranslatableSource(source)` no núcleo,
um `useTranslatable(text, sourceId, policy: 'item' | 'global')` no app e `useSourceLang` lendo de `data/`. A
linha do tempo passa a checar `source.lang` como o resto.

### 2.7 Cobertura de testes

| Área | Testado (puro) | Sem teste |
|---|---|---|
| Núcleo | refs, panel (NT + parágrafos do AT), variants, context, citations, rich-text, structured, relevance, places, timeline (3 arquivos), translate-segments/batch, morph (só grego), models/provider/IA | Strong com sufixo; TBESH; `isContentToken` hebraico; aramaico; esquema físico; `resolveCite` em `tok:hot:` |
| App | `study/thread.ts` (443 l.), `timeline/{model,context-model,combos,parallel-lanes}`, `reader/nav-sequencing`, `common/back-registry`, `data/*`, `settings/*`, `translate/{engine,offer-session}` | `study/format.ts`, `study/keyword.ts` (usado pelo fio), `common/cites.ts` (`pickLexicon`), lentes, prévia (`facts`), `WordPanel` |
| Pipeline | nenhum teste Python | `strong_base`, `cite_id`, mapeamento de corpus |
| Infra | `npm test` (vitest), `npm run typecheck` (**só o núcleo**) | typecheck do app no script raiz, lint, verificação de imports, CI (não existe `.github/workflows`) |

Todas as fixtures de painel são de Filipenses (`packages/core/test/fixtures.ts:65-72`) e de `thread.test.ts` com
tokens `gnt`. Por isso os bugs do §1 passaram.

---

## 3. Arquitetura-alvo (incremental)

### 3.1 Módulo de domínio único no núcleo: `packages/core/src/domain/`

Objetivo: **um lugar só** responde "qual é a língua desta palavra, de que testamento ela é, que léxico usar e como
falar dela". Tipos que tornam o erro difícil de escrever:

```ts
// domain/language.ts
export type Lang = 'grc' | 'hbo' | 'arc';
export type Corpus = 'gnt' | 'hot';
export type Testament = 'OT' | 'NT';
export const CORPUS: Record<Corpus, { testament: Testament; langs: readonly Lang[]; tokensSource: string;
  baseEditions: readonly string[]; interlinearText: string }> = {
  gnt: { testament: 'NT', langs: ['grc'], tokensSource: 'tagnt', baseEditions: ['TR', 'BYZ', 'NA'], interlinearText: 'grc-tr' },
  hot: { testament: 'OT', langs: ['hbo', 'arc'], tokensSource: 'tahot', baseEditions: ['L'], interlinearText: 'hbo-wlc' },
};
export function testamentOfBook(book: number): Testament;          // usa BOOK_TABLE, não "40"
export function langOfToken(t: Pick<Token, 'corpus' | 'morph'>): Lang; // 'arc' pelo prefixo A da morfologia
export function testamentLabel(t: Testament): 'AT' | 'NT';

// domain/strong.ts
declare const brand: unique symbol;
export type StrongBase = string & { [brand]: 'StrongBase' };       // só sai de parseStrong
export interface Strong { raw: string; base: StrongBase; prefix: 'G' | 'H'; number: number; suffix: string | null }
export function parseStrong(s: string): Strong | null;              // regra única (= a do pipeline)
export function testamentOfStrong(s: Strong): Testament;            // substitui isOldTestament/startsWith('H')

// domain/lexicon.ts
export const LEXICONS: Record<Lang, { primary: string; secondary?: string; label: string }> = {
  grc: { primary: 'stepbible-tbesg', secondary: 'stepbible-tflsj', label: 'TBESG' },
  hbo: { primary: 'stepbible-tbesh', label: 'TBESH' },
  arc: { primary: 'stepbible-tbesh', label: 'TBESH' },
};
export function pickLexicon(entries: LexiconEntry[], strong: Strong, lang: Lang): { primary; secondary };
// prioridade: key === strong.raw → primeiro da base na fonte primária → null (nunca outra língua)

// domain/word.ts  — o que a UI precisa para rotular uma palavra
export interface WordFacts { lang: Lang; testament: Testament; strong: Strong | null; lexiconLabel: string;
  script: 'greek' | 'hebrew'; dir: 'ltr' | 'rtl'; isContent: boolean }
export function wordFacts(t: Token): WordFacts;
```

Também entram no domínio: `isContentToken` por língua (tabela Robinson + tabela OSHB/ETCBC), `isIntroVid`,
`isIntroCommentary`, uma regex de script (`SCRIPT_WORD_RE`, `scriptOf(word)`) e as edições-base por corpus
(`hasEdition` continua; `BASE_EDITIONS` vira `CORPUS[c].baseEditions`).

Strings ("no NT", "hápax no AT") recebem o `Testament`, não um booleano: `STUDY.factVv(n, testament)`,
`SRC.concordance(n, testament)`.

### 3.2 Consultas que carregam a língua

- `Repo.concordance(strongBase, …)` passa a devolver também `testament` (ou recebe o `Corpus`) e escolhe as amostras
  de uma fonte de texto que cubra o testamento.
- `Repo.lexicon` aceita `Lang` opcional e filtra pela fonte do léxico.
- `PanelData.layers.language` ganha `words: WordFacts[]` já calculados, para as features não refazerem a conta.

### 3.3 Registro de fontes e tradições

Opção A (só núcleo, menor esforço): `packages/core/src/sources.ts` com um registro único
`SOURCES: Record<id, { short: string; commentator?: string; role: 'text' | 'interlinear' | 'lexicon' | ... }>` e
`TRADITIONS: Record<id, { pt: string }>`. Isso substitui as 6 tabelas do §1.6, mais `sourceLabel`, `SOURCE_LABEL`,
`TEXT_SOURCES` e `compare`. Um teste carrega a lista de fontes do `data-manifest`/`DATA_LICENSES.md` (ou do banco de
teste) e falha se alguma fonte `commentary` não tiver `commentator` e tradição com rótulo.

Opção B (contrato, maior esforço, melhor escala): o pipeline grava `source.short_name`, `source.commentator` e
`tradition` passa a ser uma enumeração documentada em `schema.sql` (com `CHECK` ou tabela `tradition(id, label_pt)`).
O núcleo só lê. Uma fonte nova vira **uma** edição no ingestor. Fazer A primeiro e migrar para B quando
`ai/novas-fontes-021ed6` entrar.

Fontes de texto: `TEXT_SOURCES` no registro com `lang`, `testaments` e `label` curto/longo; a lente Texto oferece
"original" = `CORPUS[corpusDoTrecho].interlinearText` (TR no NT, WLC no AT).

### 3.4 Camadas e regras de dependência

```
packages/core/src/domain        ← nada (só types/refs)
packages/core/src/*             ← domain
app/src/{design,ui,i18n}        ← (nada do app)
app/src/data                    ← core, design/ui
app/src/{translate,settings,state,ai,auth} ← core, data, design/ui
app/src/features/common         ← tudo acima
app/src/features/<feature>      ← tudo acima; outra feature só pelo "index.ts" público dela
app/src/app (rotas)             ← tudo
```

Regras:
1. Nenhuma camada abaixo de `features/` importa de `features/` (corrige `translate/source-lang.ts`,
   `settings/app-prefs.ts`, `FormButton` → mover `Buttons.tsx` para `ui/`, `combos` → `settings` ou `core`).
2. Sem ciclos entre features. `nav` + `reader` viram uma feature (`reader/`); `maps` usa `RefChips` de `ui/`;
   `rich` deixa de importar `study` (morfologia e `bareWord` vêm do núcleo); a timeline usa a referência curta de
   `common/format`.
3. Cada feature expõe `index.ts`; imports entre features só por ele.
4. Literais de domínio (`startsWith('H')`, `'gnt'`, `'hot'`, `% 1000`, `* 1_000_000`, `'stepbible-'`, `'tbesg'`,
   `'no NT'`) só em `packages/core/src/domain` e `repo/`.

Verificação, sem dependência nova: um teste vitest `scripts/arch.test.ts` (ou `app/src/arch.test.ts`) que lê os
arquivos `.ts/.tsx`, extrai os `import` por regex e (a) monta o grafo de pastas e falha em ciclo ou em aresta
proibida, (b) procura os literais da regra 4 fora das pastas permitidas. Começa com uma **lista de exceções** com os
casos atuais (os do §1/§2), e cada PR de migração remove itens dela. Isso evita adotar o ESLint só para isso. Se o
ESLint entrar depois (`npx expo lint`), use `import/no-restricted-paths` + `import/no-cycle` com as mesmas regras.

Somar ao script raiz: `"typecheck": "tsc -p packages/core --noEmit && tsc -p app --noEmit"`. Um workflow de CI mínimo
(`npm ci && npm run typecheck && npm test`) é barato e cobriria o trabalho de vários agentes em paralelo.

### 3.5 Convenções para novas features

1. **Modelo puro + teste antes da tela.** Regras em `<feature>/<nome>-model.ts` (sem React nem banco), testadas,
   como `timeline/model.ts` e `study/thread.ts`. A tela só compõe.
2. **Domínio vem do núcleo.** Nada de decidir língua/testamento/léxico/fonte na feature: chame `wordFacts`,
   `testamentOfBook`, `pickLexicon`, `SOURCES`. Se faltar algo, adicione no núcleo com teste.
3. **Fixture dos dois testamentos.** Toda regra que toca token, léxico ou concordância tem caso NT grego **e** AT
   hebraico (e um aramaico quando a regra usa morfologia). Fixture sugerida: 1Rs 15:15 (H0935P, H0853 `HTo`, Qere `Q`)
   e Dn 2:4 (aramaico).
4. **Arquivo de tela ≤ ~300 linhas.** Acima disso, separar subcomponentes e modelo.
5. **Strings recebem tipos de domínio** (`Testament`, `Lang`), não booleanos.
6. **Estado novo**: em um slice do store da feature, não em `useStudy`, a menos que seja de fato compartilhado entre
   leitor, folha e chat.
7. **Fonte nova**: ingestor + entrada no registro (§3.3). O teste de registro falha se faltar.

---

## 4. Plano em passos (PRs independentes)

Risco = chance de regressão visível; esforço = tamanho do diff. "Paralelo" diz com o que o passo pode rodar ao
mesmo tempo sem conflito de arquivo.

| # | Passo | Risco | Esforço | Depende de | Conflita com | Paralelo com |
|---|---|---|---|---|---|---|
| 1 | **Domínio no núcleo, só adição**: `domain/{language,strong,lexicon,word}.ts` + testes (inclui `parseStrong` igual ao pipeline e `langOfToken` com aramaico). Nenhum chamador muda. | baixo | P | — | nada | todos |
| 2 | **Fixture AT no núcleo**: 1Rs 15:15 e Dn 2:4 em `test/fixtures.ts`; testes de `buildPanel`, `concordance`, `lexicon`, `resolveCite('tok:hot:…')` | baixo | P | — | nada | 1, 4, 6, 7 |
| 3 | **Migrar os chamadores da língua/testamento/léxico** para o domínio: `isOldTestament`, `StudySheet.tsx:556`, `cards.tsx:60,82`, `thread.ts:143`, `STUDY.factVv`, `SRC.concordance`, `WordPanel` (rótulo, `TAGNT`, `Empty` do léxico), `PanelStack` (`greek`), `lexiconByBase` + `pickLexicon` unificados. Fecha os bugs relatados de forma estrutural. | médio | M | 1; **depois do merge de `painel-palavra`** | `painel-palavra` (mesmos arquivos) | 4, 6, 7 |
| 4 | **`isContentToken` por língua** (tabela OSHB/ETCBC), com testes; revisar `keyword.ts:75` para usar o domínio | médio (muda a palavra-chave e o contexto da IA no AT) | P | 1, 2 | nada no app (só `core/morph.ts`, `keyword.ts:75`) | 3 (se 3 não tocar em `keyword.ts`), 6, 7 |
| 5 | **Registro de fontes e tradições (opção A)**: `core/sources.ts`; remover as 6 tabelas; teste "toda fonte tem rótulo" | baixo | M | — ; **depois do merge de `ai/novas-fontes-021ed6`** | `novas-fontes` (`study/format.ts`), 3 (`format.ts`) | 4, 6, 7 |
| 6 | **Guarda de arquitetura**: `arch.test.ts` com a lista de exceções atual; typecheck do app no script raiz; workflow de CI mínimo | baixo | P | — | nada (arquivos novos + `package.json`) | todos |
| 7 | **Dividir `repo.ts`** em `repo/{text,language,timeline,cite}.ts`, mantendo a fachada `Repo` | baixo (mecânico) | M | — | 3 só se 3 mexer em `repo.ts` (coordenar: 3 não precisa) | 1, 2, 4, 5, 6 |
| 8 | **Desfazer os ciclos entre features**: mover `refShort`, `morphLabelsPt`, `bareWord`, `traditionLabel` para fora de `study/format`; `FormButton` → `ui/`; `loadSources`/`cacheOf`/`serial` → `data/queries.ts`; juntar `nav` + `reader`; `RefChips` → `ui/`. Remove itens da exceção do passo 6 | médio (muitos imports) | M | 3, 5 (mesmo `format.ts`) | quem mexer em `common/cites.ts` | 7 |
| 9 | **Unificar formatadores** de referência (5 → 1 no núcleo) e de morfologia pt (2 → 1), com teste | baixo | P | 8 | 8 | 4, 7 |
| 10 | **Dividir `lenses.tsx`** (uma lente por arquivo + `lens-model.ts` testado) e extrair `peek-model.ts` de `StudySheet` | médio | M | 3, 8 | qualquer trabalho em lentes | 7, 11 |
| 11 | **Texto original por testamento**: registro de textos com `hbo-wlc`; lente Texto e interlinear do leitor usam `CORPUS[c].interlinearText`; legenda das edições do AT (`L`, `Q`, `K`) e RTL | médio (UX nova; pede decisão de produto) | M | 1, 5 | 10 (`lenses.tsx`), `Reader.tsx` | 7 |
| 12 | **Tradução**: `isTranslatableSource` no núcleo; `useSourceLang` lendo de `data/`; timeline checando `source.lang`; uma API de hook com política | baixo | P | 8 | `translate/*` | 7, 10 |
| 13 | **Contrato físico e pipeline**: teste que monta um banco com `schema.sql` + `schema_physical.sql` e roda o `Repo`; teste de paridade `BOOK_TABLE` × `refs.py`; uma função `strong_base` no Python usada pelos 3 ingestores | baixo | M | — | `ai/novas-fontes-021ed6` (pipeline: `sword_common.py`) | 1–12 no app |
| 14 | **Registro de fontes no contrato (opção B)**: `source.short_name`, `commentator`, tabela de tradições | médio (rebuild do banco) | M | 5, 13 | pipeline | app |
| 15 | **Fatiar `useStudy`** em slices, hook de compatibilidade | médio | M | 8 | quase tudo no app: fazer por último | — |

### Ordem sugerida e paralelismo

- **Agora, em paralelo, sem conflito com as branches pendentes:** 1, 2, 6, 7, 13 (este último só nos testes
  e no `strong_base` do Python, se `novas-fontes` não tocar em `tagnt.py`/`tahot.py`/`stepbible_common.py`; ela
  toca `sword_common.py` e `sword_commentaries.py`).
- **Depois do merge de `painel-palavra`:** 3, e então 4 (pode ir junto de 3 se combinarem quem edita `keyword.ts`).
- **Depois do merge de `ai/novas-fontes-021ed6`:** 5, depois 14.
- **Depois de 3 e 5:** 8 → 9; 10 e 11 em sequência (os dois mexem nas lentes); 12 em paralelo com 10.
- **Por último:** 15.

Para quem trabalha em `painel-palavra` agora: corrigir pontualmente está ok, mas seria bom evitar mais um
`startsWith('H')`/`'tbesh'` literal no componente. Se o passo 1 entrar antes, use `wordFacts`/`pickLexicon` do
domínio. Se não, deixe o literal num helper local de uma linha, fácil de trocar no passo 3.
