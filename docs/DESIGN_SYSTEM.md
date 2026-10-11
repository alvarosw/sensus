# Design system do Sensus

Referência visual: [`docs/design/prototype.html`](design/prototype.html) (protótipo navegável "Sensus Estudo
Fluido"; abra no navegador em largura de celular). Código: `app/src/design/` (tokens, tema, componentes, ícones)
e `app/src/state/study.ts` (estado compartilhado). **Telas não definem cores, fontes ou raios soltos** — tudo vem
de `useTheme()` e dos tokens.

## Princípios

1. **O texto nunca sai da tela.** Estudo, fonte e pergunta abrem em camadas sobre o leitor. Na meia altura, a
   seleção continua visível e editável.
2. **Fontes antes da IA.** Ao selecionar, a folha mostra na hora o que o banco tem (comentários, variantes,
   hápax). O resumo chega depois e cita esses mesmos itens.
3. **Cada tipo, suas ações.** Uma palavra grega oferece concordância; um comentário, comparar tradições; uma
   referência cruzada abre lado a lado.
4. **Perguntar não tira você do lugar.** A conversa fica num chat flutuante; minimizar devolve exatamente onde
   você estava. Qualquer card, citação ou palavra pode ser anexado.
5. **Auditável em um toque.** Toda citação abre uma prévia com o texto da fonte e o `cite_id`. Afirmações sem
   fonte e inferências têm aparência própria.

## Fundamentos

| Token | Arquivo | Notas |
|---|---|---|
| Cores (claro/escuro) | `tokens.ts → palettes` | Tons de papel e sépia. `accent` marrom (claro) / âmbar (escuro). |
| Cores por tipo de fonte | `tokens.ts → sourceTypes` | `txt` versículo, `tok`/`lex` palavra/léxico, `com` comentário, `dic` verbete, `xr` ref. cruzada, `ent` entidade. Ponto da pílula de citação e marca de tipo. `sourceTypeOf(citeId)`. |
| Famílias | `tokens.ts → fontFamilies` | **Literata** (leitura), **Manrope** (interface), **Gentium Book Plus** (grego/hebraico, sempre), **IBM Plex Mono** (cite_id, coordenadas, códigos). Carregadas por `useSensusFonts()`. |
| Escala tipográfica | `tokens.ts → type` | Por papel: `scripture`, `bookTitle`, `chapterNumber`, `sheetTitle`, `lensTitle`, `claim`, `excerpt`, `fullText`, `body`, `bodySm`, `button`, `meta`, `eyebrow`, `cite`, `verseNumber`, `greek`, `lemma`, `lemmaHero`, `mono`. Grego inline: `greekFor(base)` (+6%). |
| Espaço | `space`, `gutter` | Margem do leitor 22, da folha 16. |
| Raios | `radius` | 4 selos · 6 pílulas · 8–12 botões · 14 cards · 20 popover · 22 folha. |
| Sombras | `shadow` | `sheet`, `pop`, `bubble`, `pin`, `segment`. |
| Movimento | `motion` | Curva `cubic-bezier(.2,.8,.2,1)`; folha 320 ms, painel 280, popover 260, chat 280. Respeitar "reduzir movimento". |
| Alturas da folha | `detents` | `peek` 0.30 · `half` 0.56 · `full` 0.93 (da área abaixo da barra superior). |
| Medidas | `size` | Barra superior 52, botão de ícone 32, bolinha 54, alça 22, toque mínimo 44. |

## Componentes base (`components.tsx`)

| Componente | Protótipo | Uso |
|---|---|---|
| `Txt` | — | Todo texto. `v` = papel tipográfico, `color` = chave da paleta, `tint` = cor literal. |
| `Greek` | `.gr` `.tgr` | Grego/hebraico inline; com `onPress` vira palavra tocável (cor `tok`, sublinhado pontilhado). |
| `TopBarButton` | `.tb-btn` | Botões da barra superior (livros, Αα, fonte do texto). |
| `IconButton` | `.icon-btn` | Expandir, fechar, voltar, minimizar. |
| `Pill` | `.pill-btn` | Escopo da seleção (`+ 1:29`, `Perícope 1:27–2:4` como `suggest`). |
| `Fact` | `.fact` | Números da base em "espiar" (comentaristas, variantes, refs., hápax). |
| `ActButton` | `.act` `.act.deepen` | Ações de lente: Detalhar (`deepen`), Ver todos (`count`). |
| `LinkButton` | `.card-actions` | Ações de texto dentro de cards. |
| `QuestionButton` | `.q` | Pergunta sugerida (abre o chat e pergunta). |
| `CitePill` | `.cite` `.cite.bad` | Citação inline; `bad` = id fora do contexto. Dentro de `<Text>`. |
| `TypeMark` | `.typemark` | Topo de card: tipo da fonte. |
| `Tag`, `EditionBadge`, `MorphPill` | `.tchip` `.ed` `.morph span` | Metadados, edições (TR destacado), morfologia em português. |
| `MeterBar` | `.occ-bar` `.rel` | Frequência no NT, relevância de ref. cruzada. |
| `Card`, `CardTop`, `SubHeader`, `Empty`, `Divider` | `.card` `.sub-h` `.empty` | Estrutura das lentes. |
| `Segmented` | `.seg` | Comparador Bíblia Livre / KJV / Grego TR. |
| `Skeleton`, `Caret` | `.skel` `.caret` | Carregamento e streaming. |
| `ClaimFrame` + `useUncitedStyle` | `.claim` | Afirmação da IA com estados de confiabilidade e menu ⋯. |
| `Icon` | SVGs do protótipo | `menu`, `chevronUp/Down`, `close`, `back`, `send`, `chat`, `minus`, `more`, `pin`, `search`. |

## Estrutura da experiência

**Uma superfície, quatro alturas.** Não há mudança de rota entre ler e estudar.

| Altura | Conteúdo |
|---|---|
| Leitura (`closed`) | Leitor contínuo entre capítulos e livros; o título no topo acompanha a posição. |
| Espiar (`peek`) | Ao selecionar: referência, alcance (+ vizinhos), fatos da base e o trilho de lentes. Sem IA. |
| Estudar (`half`) | Trilho de lentes (fixo no topo ao rolar) + lentes numa única rolagem. Tocar uma lente rola até ela de qualquer posição. A seleção fica visível acima e tocável. |
| Aprofundar (`full`) | Tela cheia para ler fontes; painéis empilhados com trilha de volta. |

**Gestos e seleção.** Tocar seleciona e abre "espiar". Tocar outro estende o intervalo (mesmo em outro capítulo).
Alças arrastáveis ajustam início e fim. Tocar dentro reduz a esse versículo (com desfazer no aviso). Quando a
seleção corta uma unidade literária, a folha sugere expandir para a perícope. `± versículo` inclui vizinhos sem
rolar. Uma referência cruzada pode ficar fixada no topo do leitor (lado a lado). Tocar no título abre "ir para".

**Lentes** (`LENS_KEYS`): Visão geral · Texto · Literário · Histórico · Língua · Intertexto · Interpretação ·
Aplicação. Cada lente: título + contagem, bloco da IA (resumo daquela seção com citações), conteúdo
determinístico formatado por tipo, ações (Detalhar abre na própria lente; Ver todos), perguntas sugeridas.

**Chat flutuante.** Bolinha arrastável para qualquer borda; três pontos quando a resposta é escrita com o chat
fechado; contador vermelho de não lidas. Abre por: bolinha, pergunta sugerida, "Perguntar" num card/citação (já
anexa o item) ou ação rápida. Vazio mostra sugestões da lente visível. Minimizar devolve à mesma posição. Painéis
(palavra, fonte) abrem por cima do chat; voltar retorna à conversa.

**Prévia e painéis.** Tocar citação → popover com trecho, fonte, tradição e `cite_id` (ações: Abrir completo,
Perguntar, Mostrar no texto). "Abrir completo" → painel empilhado (texto completo, licença, referências) com
trilha (`crumbs`).

## Catálogo: formato e ações por tipo

Três famílias de ação em todo o app: **detalhar** (mais do mesmo item), **fontes** (de onde vem) e **perguntas**
(anexar à conversa com uma pergunta pronta).

| Tipo | Origem | Formato | Detalhar | Fontes | Perguntas |
|---|---|---|---|---|---|
| Versículo / tradução | `verse_text` `txt:` | Serifa, número sobrescrito; no estudo, comparador BLivre / KJV / Grego TR. | Comparar; grego por baixo (Αα). | Edição e licença; divisões. | Anexar versículo. |
| Palavra original | `token` `tok:` | Gentium, pontilhado quando tocável; pílulas de morfologia em português; barra de frequência; selo de hápax. | Painel da palavra: morfologia, edições, léxico, concordância. | TAGNT + TBESG. | "Qual a força desta forma?" |
| Variante textual | `token.editions` | Linha por leitura com selos de edição (TR destacado); omissão = "omite". | Analisar cada leitura. | Edições e nota. | "As variantes mudam o sentido?" |
| Léxico | `lexicon_entry` `lex:` | Lema, glosa, definição TBESG; LSJ sob demanda. | Ver no LSJ. | Fonte, cite_id. | "O que o sentido acrescenta aqui?" |
| Concordância | `token.strong_base` | Contagem, chips de referência, ocorrência atual destacada. | Filtrar por livro; abrir ocorrência. | TAGNT. | "Como Paulo usa esta palavra?" |
| Vizinhança e divisões | neighbors · `text_division` | Faixa com vizinhos apagados e a seleção no meio; "incluir". | Incluir vizinho; expandir à perícope. | Divisões; introdução do livro. | "Como se liga ao anterior?" |
| Entidade | `entity` `ent:` | Lugar com mini-mapa e coordenadas; pessoa com papel. | Ver entidade; outras passagens. | Theographic, TIPNR, OpenBible. | "O que se sabe de Filipos no séc. I?" |
| Verbete | `dictionary_entry` `dic:` | Cabeçalho + 4 linhas. | Ler inteiro; traduzir. | ISBE, Easton, Smith. | Anexar verbete. |
| Índice temático | `dictionary_entry` (topical) | Etiquetas tocáveis. | Prévia do tema. | Nave, Torrey. | "Onde mais este tema aparece?" |
| Referência cruzada | `xref` `xr:` | Destino em destaque, origem em cinza, barra de relevância, texto do destino. | Fixar lado a lado. | OpenBible/TSK com peso. | "Como se relacionam?" (anexa as duas pontas) |
| Comentário | `commentary` `com:` | Autor, tradição, versículo; trecho em serifa; matriz de quem comenta cada versículo; filtro por tradição. | Ler completo; mais do autor. | Obra, tradição, licença. | "Onde os comentaristas divergem?" |
| Afirmação da IA | `ClaimInfo` | Citações coloridas por tipo; inferência em moldura azul; frase sem fonte sublinhada. | ⋯ → Detalhar este ponto. | ⋯ → De onde vem isso? | ⋯ → Perguntar sobre isto. |

## Estados de confiabilidade

| Estado | Aparência |
|---|---|
| Com fonte | Texto normal + pílulas de citação. |
| Inferência | `ClaimFrame kind="inference"`: fundo `inf`, borda esquerda `infBorder`, rótulo "INFERÊNCIA" (o "(Inferência)" some do texto). Frase de inferência dentro de um bloco com fonte: fundo `inf` só na frase, rótulo visível. |
| Sem fonte | Só a frase factual sem citação (a citação do parágrafo cobre as frases anteriores a ela): sublinhado pontilhado `warnText`. Sem rodapé. |
| Citação inválida | `CitePill bad`: "?" riscado em vermelho; prévia explica que o id não estava no contexto. |
| Divergência morfológica | Termo sublinhado + aviso âmbar "O token citado é subjuntivo" (de `morphConflicts`). |

## Convenções

- `testID` em kebab-case para tudo que é tocável: `verse-<vid>`, `lens-<key>`, `rail-<key>`, `cite-<cite_id>`,
  `fact-<key>`, `qa-<key>`, `sheet`, `sheet-detent-<name>`, `bubble`, `chat`, `composer-input`, `panel-<kind>`.
- Português do Brasil em toda a interface; strings em `app/src/i18n`.
- Acessibilidade: `accessibilityRole`/`accessibilityLabel` em botões só de ícone; alvo de toque ≥ 44 px
  (use `hitSlop`).
