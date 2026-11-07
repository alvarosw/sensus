# Licenças dos dados

Este arquivo lista todas as fontes de dados do Sensus, com licença, origem e atribuição exigida.
Foi montado a partir dos metadados de `data/staging/*/source.json` (34 fontes, incluindo `sensus-nomes-pt`, `sensus-titulos-pt` e `sensus-descricoes-pt`). Os bancos gerados
(`sensus.db`, completo, e `sensus-reader.db`, do APK) gravam licença, URL, versão e atribuição de cada fonte na tabela `source`.

> Não é parecer jurídico. Itens marcados **Verificar** dependem de interpretação ou de confirmação
> na fonte antes da distribuição.

## 1. Regras para o banco distribuído (`sensus.db`)

1. **Share-alike (Theographic, CC BY-SA 4.0).** O banco que inclui os dados do Theographic
   (entidades e descrições) deve ser distribuído sob CC BY-SA 4.0 ou licença compatível, com atribuição.
   O `sensus.db` distribuído fica, portanto, sob CC BY-SA 4.0 no que deriva do Theographic.
2. **Restrição não comercial (Robertson, RWP) não é CC.** A cláusula "distribuição livre apenas não
   comercial" vale para o conteúdo do RWP. A licença CC BY-SA do banco não a amplia nem a substitui.
   Por isso o banco não é uma obra única sob uma licença só: cada fonte mantém os seus termos.
   Opções: (a) manter o RWP com aviso de uso não comercial no app, enquanto o app for não comercial;
   (b) excluir o RWP do build distribuído. **Decisão do responsável.** Ver itens 1 e 2 de "Verificar".
3. **Atribuição visível no app.** CC BY e CC BY-SA exigem crédito. O app deve exibir a atribuição de
   cada fonte usada (requisito registrado em `docs/BACKLOG.md`, seção Licenças).
4. **Coordenadas com origem no OpenStreetMap.** Ver item 4 da seção "Verificar".
5. **Build completo.** `data/sensus.db` (versão 2026.10.11) tem as 31 fontes e os 66 livros. O banco leitor
   (`data/sensus-reader.db`, no APK) tem só `blivre`, `kjv`, `grc-tr`, `hbo-wlc` e os parágrafos de `tagnt` e
   `tahot`, todos com a mesma atribuição do banco completo. Ver seção 6.

## 2. Fontes

### 2.1 CC BY-SA 4.0

| Fonte (id) | Título e autor | Origem | Atribuição exigida | Condições |
|---|---|---|---|---|
| `theographic` | Theographic Bible Metadata, Robert Rouse (viz.bible) | https://github.com/robertrouse/theographic-bible-metadata (commit cfb1c48) | Theographic Bible Metadata, por Robert Rouse / viz.bible (https://github.com/robertrouse/theographic-bible-metadata), licença Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). | **Share-alike.** Descrições vêm de dictionaryText, em inglês, e incluem texto do Easton (1897, domínio público). Links Markdown removidos. |
| `sensus-titulos-pt` | Títulos de eventos em português (derivados), a partir de `theographic` | Derivado de `theographic` (commit cfb1c48), por `pipeline/ingest/titulos_pt.py` | Mesma atribuição de `theographic` (CC BY-SA 4.0), de quem vêm os títulos em inglês; a tradução é do projeto: "títulos traduzidos e revisados pelo projeto Sensus". | **Share-alike**, como `theographic`. **Derivado**: título pt de cada evento, escrito e revisado por agentes de IA, conferindo os versículos da Bíblia Livre e pesquisando em caso de dúvida (nota "rev. IA" em `pipeline/ingest/corrections/titulos-eventos-pt.tsv`); só os de origem revisado entram no banco. Sem tradução automática no aparelho. |
| `sensus-descricoes-pt` | Descrições das entidades em português (derivadas), a partir de `theographic`, `stepbible-tipnr` e `openbible-geo` | Derivado de `theographic` (commit cfb1c48), `stepbible-tipnr` (commit dd88ab3) e `openbible-geo` (commit 7eb18a5), por `pipeline/ingest/descricoes_pt.py` | Theographic Bible Metadata, por Robert Rouse / viz.bible, CC BY-SA 4.0; TIPNR, dados criados por STEP Bible (www.STEPBible.org), baseados em trabalho da Tyndale House Cambridge, CC BY 4.0; OpenBible.info Bible Geocoding Data, CC BY 4.0. A tradução é do projeto: "descrições traduzidas e revisadas pelo projeto Sensus". | **Share-alike**, como `theographic`. **Derivado**: as descrições do TIPNR são traduzidas por regra do projeto (`pipeline/sensus/descricoes_pt.py`, glossário em `pipeline/ingest/corrections/glossario-descricoes.tsv`); descrição que a regra não reconhece não entra. As de theographic e openbible-geo foram traduzidas e revisadas por agentes de IA (nota "rev. IA" em `pipeline/ingest/corrections/descricoes-pt.tsv`); só as de origem revisado entram. Sem tradução automática no aparelho. |

### 2.2 CC BY 4.0 — STEP Bible / Tyndale House

Atribuição comum: *Dados criados por STEP Bible (www.STEPBible.org), baseados em trabalho da Tyndale House
Cambridge. Licença CC BY 4.0: credite "STEP Bible" com link para www.STEPBible.org.*
(Fonte do repositório: https://github.com/STEPBible/STEPBible-Data, commit dd88ab3.)

| Fonte (id) | Título | Condições |
|---|---|---|
| `tagnt` | Translators Amalgamated Greek NT (TAGNT) | Inclui tokens sintéticos para leituras alternativas (TR/BYZ). |
| `grc-tr` | Textus Receptus, derivado do TAGNT | Palavras marcadas como presentes no TR. |
| `tahot` | Translators Amalgamated Hebrew OT (TAHOT) | Base Leningrado, com correções da STEPBible. |
| `hbo-wlc` | Hebraico do AT (Leningrado), derivado do TAHOT | Mesma base do TAHOT. |
| `stepbible-tbesg` | TBESG, léxico grego | Definições baseadas em Abbott-Smith, editadas pela STEPBible. |
| `stepbible-tbesh` | TBESH, léxico hebraico | Definições baseadas em BDB (abreviado). |
| `stepbible-tflsj` | TFLSJ, LSJ formatado | Base Liddell-Scott-Jones (domínio público), formatada pela Tyndale House. |
| `stepbible-tipnr` | TIPNR, nomes próprios | Coordenadas via OpenBible.info, ver item 4 de "Verificar". |
| `tvtms` | Translators Versification Traditions with Methodology for Standardisation (TVTMS), seção Expanded | Não entra no banco: regra de alinhamento da numeração das Bíblias à KJV (`pipeline/bibles/tvtms.py`). Arquivo bruto em `data/raw/bibles/tvtms/`, fora do git. Crédito incluído na atribuição das Bíblias alinhadas. |

### 2.3 CC BY 4.0 — OpenBible.info

| Fonte (id) | Título | Origem | Atribuição exigida | Condições |
|---|---|---|---|---|
| `openbible-geo` | OpenBible.info Bible Geocoding Data | https://github.com/openbibleinfo/Bible-Geocoding-Data (commit 7eb18a5) | Bible geocoding data: OpenBible.info (https://www.openbible.info/geo/), licença Creative Commons Attribution 4.0 (CC BY 4.0). | **Verificar ODbL** (item 4). Textos em inglês, não traduzidos. |
| `openbible-xref` | OpenBible.info Cross References | https://www.openbible.info/labs/cross-references/ (data 2026-10-05) | Referências cruzadas: OpenBible.info (https://www.openbible.info/labs/cross-references/), licença CC BY 4.0. | Só atribuição, sem share-alike. Peso pode ser negativo. Sem remapeamento para KJV. |

### 2.4 CC BY 3.0 Brasil

| Fonte (id) | Título | Origem | Atribuição exigida | Condições |
|---|---|---|---|---|
| `blivre` | Bíblia Livre (porbr2018), Diego Santos, Mario Sérgio, Marco Teles | https://ebible.org/find/details.php?id=porbr2018 ; repositório blivre/BibliaLivre (LICENCA.md) | Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - fevereiro de 2018. Licença Creative Commons Atribuição 3.0 Brasil (http://creativecommons.org/licenses/by/3.0/br/). | Usa a licença 3.0 do LICENCA.md do projeto. O eBible cita 4.0 Brasil. As duas exigem atribuição. Notas de rodapé e referências removidas. |
| `sensus-nomes-pt` | Nomes próprios em português (derivados), a partir de `blivre` | Derivado de `blivre` (porbr2018), por `pipeline/ingest/nomes_pt.py` | Mesma atribuição de `blivre` (CC BY 3.0 Brasil), de quem vêm os nomes. | **Derivado**: o nome pt de cada entidade é a palavra da Bíblia Livre que aparece nos mesmos versículos do nome inglês (theographic, stepbible-tipnr, openbible-geo), escolhida sem IA. As linhas de confiança média/baixa foram revisadas por agentes de IA conferindo os versículos (notas em `pipeline/ingest/corrections/nomes-pt-revisao.tsv`). Revisão em `pipeline/ingest/corrections/nomes-pt.tsv`. Compostos só com a frase achada no texto. |

### 2.5 Não comercial (declarada pelo módulo)

| Fonte (id) | Título e autor | Origem | Atribuição exigida | Condições |
|---|---|---|---|---|
| `sword-rwp` | Robertson's Word Pictures in the New Testament, A. T. Robertson (1863-1934) | https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/RWP.zip (módulo SWORD RWP v2.0) | Robertson's Word Pictures, A. T. Robertson (1863-1934). Módulo SWORD RWP v2.0 (CrossWire Bible Society). Vols. 5 e 6: (c) 1932 e 1933 Broadman Press, renovação 1960, usado com permissão. Fonte do texto: www.bf.org. | **Somente uso não comercial** (licença do módulo). Aprovado pelo responsável como app comunitário não comercial. **Se o app for comercializado, remover esta fonte.** Expiração de copyright: ver item 1 de "Verificar". |

### 2.6 GPL declarada no módulo (texto de domínio público)

| Fonte (id) | Título | Origem | Atribuição exigida | Condições |
|---|---|---|---|---|
| `kjv` | King James Version (1769), com Strong e morfologia removidos (SWORD KJV v3.1) | https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/KJV.zip | Texto KJV do módulo SWORD 'KJV' (CrossWire Bible Society). Licença declarada no .conf do módulo: GPL. O texto-base da KJV é de domínio público; o Crown copyright do Reino Unido é mencionado no About do módulo. | O texto é de domínio público, mas o pacote do módulo declara GPL. Ver item 5 de "Verificar". |

### 2.7 Domínio público

Atribuição padrão: *Nome do autor. Título. Módulo SWORD X vN, distribuído pela CrossWire Bible Society;
domínio público (DistributionLicense=Public Domain).* A atribuição completa de cada fonte está no campo
`attribution` do `source.json`.

**Comentários**

| Fonte (id) | Autor (vida) | Título / edição | Versão SWORD | Condições |
|---|---|---|---|---|
| `gill` | John Gill (1697-1771) | An Exposition of the Entire Bible (1748-1763) | SIGILL v1.0 (SermonIndex.net) | Texto original. A edição modernizada do módulo Gill do Xiphos (ARR) **não** foi usada. Ver item 6. |
| `patristic` | Pais da Igreja (vários) | Trechos verificados literalmente em edições PD (ANF/NPNF, Gifford, Pusey, Payne Smith, Gardner, Edgecomb) via New Advent, CCEL, Tertullian.org | commit 8e8082b do Commentaries-Database | Só trechos verificados. Seleção e indexação do repositório, que não tem licença de redistribuição declarada como um todo. Ver item 7. |
| `sword-barnes` | Albert Barnes (1798-1870) | Barnes' New Testament Notes | v1.1 | PD. |
| `sword-calvincommentaries` | João Calvin (1509-1564) | Calvin's Collected Commentaries | v1.1 | PD. Notas do módulo trazem e-mail de quem converteu o módulo. Ver item 8. |
| `sword-clarke` | Adam Clarke (1762-1832) | Commentary and Critical Notes on the Bible | v2.0 | PD. |
| `sword-jfb` | Jamieson, Fausset, Brown (1871) | Critical and Explanatory Commentary on the Whole Bible | v3.0 | PD. Ver item 8 (e-mail no texto). |
| `sword-kd` | Keil e Delitzsch (1864) | Biblical Commentary on the Old Testament | v2.0 | PD. |
| `sword-mhc` | Matthew Henry (1662-1714) | Complete Commentary on the Whole Bible | v2.2 | PD. Texto do CCEL. |
| `sword-scofield` | C. I. Scofield (1843-1921) | Reference Notes, edição de 1917 | v2.1 | PD. |
| `sword-wesley` | John Wesley (1703-1791) | Notes on the Bible | v1.1 | PD. |
| `sword-abbott` | John S. C. Abbott (1805-1877) e Jacob Abbott (1803-1879) | Illustrated New Testament (1878) | v1.1 | PD (`DistributionLicense=Public Domain`). |
| `sword-burkitt` | William Burkitt (1650-1703) | Expository Notes with Practical Observations on the New Testament | v1.0 | PD. |
| `sword-catena` | Tomás de Aquino (1225-1274), compilação de Pais da Igreja | Catena Aurea (Evangelhos) | v1.0.1 | PD. |
| `sword-lightfoot` | John Lightfoot (1602-1675) | Commentary on the New Testament from the Talmud and Hebraica | v1.0 | PD. Texto de philologos.org. |
| `sword-luther` | Martinho Lutero (1483-1546) e outros | Luther's Commentary on Selected Bible Passages | v1.1 | PD pelo `.conf`. O About cita edições de 1892 a 1932 (Lenker, Hay, Holman); conferir cada parte. Ver item 12. |
| `sword-pnt` | B. W. Johnson (séc. XIX) | The People's New Testament, com notas explicativas | v1.1 | PD. |
| `sword-tfg` | J. W. McGarvey (1829-1915) e Philip Y. Pendleton | The Fourfold Gospel e Commentary on Acts | v1.5 | PD. Módulo RawCom (texto sem compressão). Sem marcas de referência cruzada GBF. |

**Adventistas (domínio público)**

Autora falecida em 1915. As obras são publicadas antes de 1929 (domínio público nos EUA) e, no Brasil, pela regra de
vida mais 70 anos. Só entram textos de Project Gutenberg e archive.org, nunca de egwwritings.org ou de PDFs do White
Estate. Ver item 12. Não são comentários versículo a versículo: só parágrafos com referência explícita geram linhas.

| Fonte (id) | Autor | Título e edição | Origem do texto | Condições |
|---|---|---|---|---|
| `egw-great-controversy` | Ellen G. White (1827-1915) | The Great Controversy (1911) | Project Gutenberg #25833 | Cabeçalho e rodapé do Gutenberg removidos. Notas e índice (apêndice) não usados. |
| `egw-patriarchs` | Ellen G. White (1827-1915) | The Story of Patriarchs and Prophets (1913; copyright 1890) | Project Gutenberg #79498 | Cabeçalho e rodapé do Gutenberg removidos. Notas de rodapé ligadas pelo marcador [n]. |
| `egw-prophets` | Ellen G. White (1827-1915) | The Story of Prophets and Kings (1917) | archive.org `storyofprophetsk0000elle` | Cabeçalhos de página removidos. |
| `egw-acts` | Ellen G. White (1827-1915) | The Acts of the Apostles (1911) | archive.org `actsapostlesinp00unkngoog` | Palavras ilegíveis no OCR trocadas pela edição de 1911 do mesmo texto (archive.org `actsofapostlesin0000elle`), só com vizinhança idêntica. |
| `egw-object-lessons` | Ellen G. White (1827-1915) | Christ's Object Lessons (1900) | archive.org `christsobjectles00whit` | Palavras ilegíveis no OCR (marcadas por `{`) trocadas pela palavra da edição de 1900 do mesmo texto (archive.org `christsobjectles0000unse_h6u4`), só com vizinhança idêntica. |
| `egw-steps` | Ellen G. White (1827-1915) | Steps to Christ (1892; edição de 1896) | archive.org `stepstochrist00whit` | Texto da edição de 1896. |
| `egw-thoughts` | Ellen G. White (1827-1915) | Thoughts from the Mount of Blessing (1896; impressão de 1928, copyright 1900 e 1928) | archive.org `thoughtsfrommoun0000unse` (Cincinnati Bible College & Seminary) | Comentário do Sermão do Monte. Legendas de ilustração (título em maiúsculas, citação e "— Page N") removidas, com o OCR solto ao redor; o parágrafo cortado por elas volta a ser um só. Parágrafos com marca de OCR ruim ou sem correspondência descartados (`strict_ocr`). Seções de Mateus 5–7: a epígrafe de cada seção (igual ou quase igual ao texto da KJV) liga os parágrafos da seção ao versículo (`sermon_sections`). Regra de aspas abaixo. |
| `smith-daniel` | Uriah Smith (1832-1903) | Daniel and the Revelation (1897; edição de 1907, copyright 1907 da viúva) | archive.org `danielrevelation0000smit` (Claremont School of Theology) | Estudo versículo a versículo, não de Ellen G. White. Notas de cabeçalho de página e sumário removidos. Aspas do OCR restauradas (regra abaixo). Parágrafos com sinais de OCR ruim (`|`, `\`, `i`/`j` solto, `,1` colado) e com "Tt" (por "It") descartados. |

**Segunda leva (domínio público; autores falecidos antes de 1923, obras publicadas de 1873 a 1905).** Mesma regra de
parágrafo com referência explícita. Títulos pt: *O Desejado de Todas as Nações* é o nome da edição brasileira; os
demais são tradução nossa do título inglês, sem conferir edição brasileira. Citações de margem ou de nota (parágrafo só com texto da Escritura, conferido pela KJV) saem do comentário: com a referência casada, ou sem ela quando quase todo o texto está na Bíblia (regra `citacoes`). Ver item 12.

| Fonte (id) | Autor | Título e edição | Origem do texto | Condições |
|---|---|---|---|---|
| `egw-desire-of-ages` | Ellen G. White (1827-1915) | The Desire of Ages (1898, Pacific Press) | archive.org `desireofages00whit` | Scan sem aviso de 1940 nem de 1964 (os de `desireofages0000elle_w5v8` e `_z5c9` trazem, e não são usados). Rodapés de referência (`^^Zech. 9:16, 17.`) saem do texto e ligam ao parágrafo da página (`page_notes`). "This chapter is based on…" (nota editorial) sai. Parágrafos com `©` (OCR) descartados. |
| `waggoner-galatians` | E. J. Waggoner (1855-1916) | The Glad Tidings (1900, Pacific Press; copyright 1900) | Project Gutenberg #63636 | Comentário de Gálatas. Sumário do Gutenberg (capítulos com página) removido. A citação em bloco é da Revised Version, que não casa com a KJV: a ligação é só por referência explícita. |
| `waggoner-christ` | E. J. Waggoner (1855-1916) | Christ and His Righteousness (1893, Echo Publishing) | archive.org `christ-and-his-righteousness-1893-echo-publishing` | Cabeçalhos de página removidos. Parágrafos com `©` ou `|` (OCR) descartados. |
| `andrews-sabbath` | John Nevins Andrews (1829-1883) | History of the Sabbath and First Day of the Week (1873) | Project Gutenberg #68714 | Notas de rodapé ligadas pelo marcador, como em `egw-patriarchs`. Sumário e índice do Gutenberg fora do texto. |
| `smith-us-prophecy` | Uriah Smith (1832-1903) | The United States in the Light of Prophecy (1874) | Project Gutenberg #12364 | Comentário de Apocalipse 13 e Daniel 7. Sem capítulos numerados no texto. |
| `smith-sanctuary` | Uriah Smith (1832-1903) | The Sanctuary and the Twenty-three Hundred Days of Daniel VIII, 14 (1877) | archive.org `sanctuarytwentyt0000smit` | Dn 8:14 e o santuário. Cabeçalhos "THE SANCTUARY." removidos. O índice remissivo e o catálogo do editor (com anúncios) saem do texto, a partir do cabeçalho "INDEX. 349" (`skip`). Parágrafos com `©` descartados. |

Fora do banco por enquanto: `haskell-daniel` e `haskell-seer` (Stephen N. Haskell, 1855-1922; *The Story of Daniel the
Prophet*, 1901, e *The Story of the Seer of Patmos*, 1905, Review and Herald, archive.org). Domínio público, mas o
scan mistura citações bíblicas de margem, perguntas de estudo e fragmentos de OCR no comentário; entram quando a
limpeza passar na amostragem.

**Examinadas e não incluídas (adventistas e outras):** *Ministry of Healing* (1905/1909): o scan de 1909 não tem
referência explícita em parágrafo, e o de 1905 traz aviso de 1942 (edição revisada); não está no Gutenberg. *Education*
(1903): no Gutenberg (#62102), as referências são linhas curtas de lista (cerca de 35), sem comentário; no archive.org,
uma linha por parágrafo. *Early Writings* (1893, archive.org): 73 referências. *Testimonies* (1901): poucas referências
explícitas no volume lido. *The Great Empires of Prophecy* (Jones, 1898, archive.org): OCR com barras verticais
(cerca de 100 referências). *Bates*, *The Opening Heavens* e *Seventh Day Sabbath* (Gutenberg): 4 e 2 parágrafos com
referência. *The Complete Testimony of the Fathers* (Andrews, Gutenberg #55818): tema patrístico, 53 referências.
*The State of the Dead* (Smith, 1873): sem referência explícita. *Sketches from the Life of Paul* e *Looking Unto Jesus*:
não encontradas em Gutenberg nem em archive.org.

**Examinadas e não incluídas (outras):** Geneva Bible Translation Notes e Family Bible Notes (sem `DistributionLicense` no
`.conf`; o scan de 1599 no archive.org não traz licença); Darby Translation Notes (índice não alinhado à versificação).
Ver item 12 para as demais.

**Dicionários**

| Fonte (id) | Autor | Título | Versão SWORD |
|---|---|---|---|
| `sword-easton` | M. G. Easton (1897) | Easton's Illustrated Bible Dictionary | v2.0.1 |
| `sword-hitchcock` | Roswell D. Hitchcock | Hitchcock's Bible Names Dictionary | v2.0 |
| `sword-isbe` | James Orr (ed. geral) e colaboradores | International Standard Bible Encyclopedia | v2.2. Ver item 9. |
| `sword-smith` | William Smith | Smith's Bible Dictionary | v1.3 |

**Tópicos e referências**

| Fonte (id) | Autor | Título | Versão SWORD |
|---|---|---|---|
| `sword-nave` | Orville J. Nave | Nave's Topical Bible | v3.0 |
| `sword-torrey` | R. A. Torrey | Torrey's New Topical Textbook | v1.3 |
| `sword-tsk` | Canne, Browne, Blayney, Scott et al. (c. 1880) | Treasury of Scripture Knowledge | v1.4 |

### 2.8 Mapas (serviços de tiles e estilo; não são dados do banco)

Os mapas usam MapLibre com vetores do OpenFreeMap (esquema OpenMapTiles). Não há chave de API.
O estilo (claro e escuro) é gerado pelo app a partir dos tokens de cor; não copia o estilo de terceiros.

| Recurso | Origem | Licença | Atribuição exigida (visível no app) | Condições |
|---|---|---|---|---|
| Dados de mapa | OpenStreetMap | ODbL 1.0 | © OpenStreetMap contributors (openstreetmap.org/copyright) | Share-alike sobre banco derivado: ver item 4 de "Verificar". |
| Esquema e vetores | OpenMapTiles (via OpenFreeMap) | CC BY 4.0 | © OpenMapTiles | Atribuição em todo mapa. |
| Serviço de tiles | OpenFreeMap (openfreemap.org, `https://tiles.openfreemap.org/planet`) | MIT (projeto); uso público livre, sem limite declarado | OpenFreeMap | Fontes de glifos: `tiles.openfreemap.org/fonts` (Noto Sans). |
| Biblioteca | maplibre-react-native 11.4.0 | MIT | (em "Sobre e licenças") | Plugin nativo com `app.config.ts`. |

Atribuição mostrada: "© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap" (`features/maps/strings.ts`).
Mapa do mundo antigo (AWMC): não incluído; ver `docs/BACKLOG.md`, seção App.

### 2.9 Bíblias do repositório de Bíblias (pacotes sob demanda)

Cada pacote `bible-<id>-<versão>.zip` traz um SQLite só com o texto de uma tradução (`verse_text`,
`text_division`, `book_name`) e a licença e atribuição gravadas em `meta`. Pesquisa, critérios e Bíblias
recusadas em `docs/BIBLES_LICENSES.md`. Origem de todas: eBible.org (USFM), página de licença em
`https://ebible.org/find/details.php?id=<código>`, salvo Berean (titular) e SWORD. Toda Bíblia alinhada pela
TVTMS traz o crédito da §2.2 na atribuição.

| Fonte (id) | Título | Licença | Atribuição exigida | Condições |
|---|---|---|---|---|
| `engwebp` | World English Bible | Domínio público | World English Bible (WEB), domínio público (eBible.org). | "World English Bible" é marca do eBible: texto alterado não leva o nome. |
| `engasv` | American Standard Version (1901) | Domínio público | American Standard Version (1901), domínio público (eBible.org). |  |
| `engbsb` | Berean Standard Bible | Domínio público (dedicada em 30/04/2023) | Berean Standard Bible, domínio público (dedicada em 30/04/2023; eBible.org). | Declaração do titular (berean.bible/terms.htm); confirmar antes da release. |
| `spablm` | Santa Biblia libre para el mundo | Domínio público | Santa Biblia libre para el mundo, domínio público (eBible.org). |  |
| `spavbl` | Versión Biblia Libre | CC BY-SA 4.0 | Versión Biblia Libre, copyright © 2018-2020 Jonathan Gallagher y Shelly Barrios de Avila, licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `frasbl` | Sainte Bible libre pour le monde | CC0 1.0 | Sainte Bible libre pour le monde, domínio público (CC0 1.0) (eBible.org). |  |
| `fralsg` | Louis Segond 1910 | Domínio público | Louis Segond 1910, domínio público (eBible.org). |  |
| `frajnd` | Bible J. N. Darby | Domínio público | Bible J. N. Darby, texto em domínio público (eBible.org). |  |
| `deu1912` | Lutherbibel 1912 | Domínio público | Lutherbibel 1912, domínio público (eBible.org). |  |
| `deuelo` | Elberfelder 1905 (não revisada) | Domínio público | Elberfelder 1905 (não revisada), domínio público (eBible.org). |  |
| `arbvd` | Van Dyck (Smith-Van Dyke) | Domínio público | Van Dyck (Smith-Van Dyke), domínio público (eBible.org). |  |
| `hin2017` | IRV Hindi 2019 | CC BY-SA 4.0 | Indian Revised Version, hindi (2019), copyright © 2017-2019 Bridge Connectivity Solutions, licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `hincv` | Hindi Contemporary Version | CC BY-SA 4.0 | Hindi Contemporary Version, copyright © 1978, 2009, 2016, 2019 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `benobcv` | Open Bengali Contemporary Version | CC BY-SA 4.0 | Open Bengali Contemporary Version, Copyright © 2007, 2017, 2019 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `benirv` | IRV Bengali 2019 | CC BY-SA 4.0 | Indian Revised Version, bengali (2019), copyright © 2018-2019 Bridge Connectivity Solutions, licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `urdoucv` | Urdu Contemporary Version (aberta) | CC BY-SA 4.0 | Urdu Contemporary Version (Biblica), copyright © 1999, 2005, 2022, 2024 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `urdirv` | IRV Urdu 2019 | CC BY-SA 4.0 | Indian Revised Version, urdu (2019), copyright © 2019 Bridge Connectivity Solutions, licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `jpnm` | Freedom Bible (japonês) | Domínio público (sem direitos declarados) | Freedom Bible (japonês), sem direitos autorais declarados pelo eBible.org. | Declaração do eBible; ver `docs/BIBLES_LICENSES.md`. |
| `cmncbs` | 当代译本开放资源（简体） | CC BY-SA 4.0 | 当代译本开放资源（简体）, Copyright © 1979, 2005, 2007, 2011, 2022 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `cmncbt` | 當代譯本開放資源（繁體） | CC BY-SA 4.0 | 當代譯本開放資源（繁體）, Copyright © 1979, 2005, 2007, 2012, 2023 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |
| `vieovcb` | Kinh Thánh Hiện Đại (VCB) | CC BY-SA 4.0 | Kinh Thánh Hiện Đại (VCB), copyright © 1982, 1987, 1994, 2005, 2015 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org). | **Share-alike.** |

## 3. Verificar antes de distribuir

1. **RWP (`sword-rwp`).** Manter ou excluir é decisão do responsável. Se mantido, o app precisa exibir
   a restrição não comercial. O "About" do módulo cita expiração em 2006/2007, e isso parece
   desatualizado. Nos EUA, obras publicadas em 1932-1933 e renovadas costumam ter proteção de 95 anos,
   o que levaria a 2028-2029. No Brasil, Robertson (falecido em 1934) está em domínio público pela regra
   de vida mais 70 anos. Confirmar a jurisdição aplicável.
2. **Banco misto (`sensus.db`).** Os termos de cada fonte ficam no `source`. Antes de publicar o banco,
   decidir entre (a) excluir o RWP do build distribuído ou (b) distribuir o banco com aviso explícito de
   que as linhas do RWP são só para uso não comercial. Recomenda-se revisão jurídica.
   **Status:** a release 2026.10.11 inclui o RWP, como o build completo pede, e as notas da release repetem a
   restrição não comercial. Confirmar antes de publicar; excluir o RWP exige refazer o build.
3. **Theographic.** O banco que inclui Theographic deve ir sob CC BY-SA 4.0 com atribuição. Os metadados
   de `source.json` já registram isso.
4. **ODbL (OpenStreetMap).** Parte das coordenadas de `openbible-geo` e `stepbible-tipnr` pode vir do
   OpenStreetMap (ODbL 1.0). Adicionar o crédito "© OpenStreetMap contributors" na tela de licenças. Se
   o uso for considerado derivação de banco de dados, o ODbL pode exigir share-alike também para essa
   parte. Confirmar.
   **Status:** o crédito já aparece nos mapas e em "Sobre e licenças" (seção 2.8). Falta a decisão
   sobre share-alike.
5. **KJV (GPL declarada).** O texto é de domínio público, mas o módulo declara GPL. Manter a referência
   ao CrossWire e o aviso. Se o app distribuir código do módulo SWORD (e não só o texto), a GPL se aplica
   a esse código.
6. **Gill.** Confirmar que o SIGILL é o texto original de 1748-1763, e não uma edição modernizada com
   direitos reservados.
7. **Patrística.** O repositório Commentaries-Database não tem licença de redistribuição para o conjunto.
   O Sensus distribui só os trechos conferidos em edições PD. Manter o crédito ao repositório na seleção.
8. **E-mails de terceiros.** `sword-calvincommentaries` (notas do módulo, gravadas na tabela `source`)
   e `sword-jfb` (texto do staging) têm e-mails de terceiros. Remover antes do build. O e-mail do
   Calvin entra no banco publicado.
   **Status (2026-10-11):** a busca por endereços de e-mail em `data/staging/` não encontrou nenhum. Repetir a
   busca antes de cada release.
9. **ISBE.** Confirmar que o módulo é da edição de 1915, em domínio público. Edições posteriores podem
   ter proteção.
10. **Tela de licenças do app.** As 31 fontes estão no build completo desde 2026.10.11. A tela "Sobre e
    licenças" do app precisa listar todas, com as atribuições acima (`docs/BACKLOG.md`, seção Licenças).

12. **Adventistas e Luther.** (a) Os textos de Ellen G. White são de autora falecida em 1915; as edições usadas são
    anteriores a 1929. Se algum scan for de edição posterior, ou tiver aviso de direitos de edição revisada, a fonte sai.
    (b) O `sword-luther` reúne material de várias edições; o `.conf` declara PD. Revisar antes de distribuir.
    (c) `smith-daniel` usa a edição de 1907 (Southern Publishing Association; entrada de 1897, copyright 1907), não a de 1903. O scan de 1897 (`danielrevelation00smit_3`) trocava aspas por "4 '", "u" e "' '" (214 de 863 linhas) e não é usado. OCR com sinais ruins é descartado. Outras fontes de OCR: só com texto revisado.
    **Correções de OCR (`smith-daniel` e `egw-thoughts`):** cada correção está em `pipeline/ingest/corrections/<fonte>.tsv` (parágrafo, posição, original, corrigido, regra). Só restaura o texto original; nada é reescrito. Regras: **a** = a palavra ilegível tem, na outra digitalização de domínio público da mesma obra (`danielrevelation00smit_3`, `danielrevelation00smit_0`; `thoughtsfrommoun0000egwh`, 1928), as mesmas duas palavras antes e depois, e a forma de lá é palavra do dicionário inglês a até 1-3 letras da ilegível; **b** = uma única troca típica de OCR (fh→th, tbe→the, wbich→which, aud→and) dá palavra do dicionário que também aparece no outro scan; **c** = capitular perdida: palavra em maiúsculas de 2 ou mais letras (HE, HIS, ORE, OME, ITH, ou não-palavra) que, com uma letra à frente, forma palavra cujo par com a palavra seguinte aparece no outro scan (HE Lord's → THE Lord's); **d** = símbolo de linha colado (`~The`) e número de página entre parênteses confirmado pela outra digitalização (`(28)` no meio da frase) saem; **c2** = capitular em início de seção (primeiro parágrafo depois de epígrafe de Mt 5–7, ou depois de novo capítulo): palavra em maiúsculas (HE) que as duas digitalizações leem igual e que, com uma letra à frente, forma par válido com a palavra seguinte (the effort, no effort) enquanto o par como está não aparece no texto desta obra. **e** = nota de rodapé intercalada no meio do parágrafo ("Dan. 7:25, For biographical sketches, see Appendix."; "[For portraits, see page 150.]") sai; se a frase continua depois da nota com palavra partida que não está no parágrafo, o parágrafo sai (drop). **drop** = parágrafo com lixo que não se restaura (símbolo de linha, letra colada a dígito, sílaba sem vogal, letra solta) sai do banco, com a lista de palavras no TSV. Palavra desconhecida mas pronunciável (nome próprio, termo raro) fica como está. O gerador é `pipeline/ingest/adventist_ocr_audit.py` (usa `/usr/share/dict/american-english`).
    **Regra de aspas (`smith-daniel` e `egw-thoughts`):** o OCR que gravou aspas duplas como dois apóstrofos ("‘‘" de abertura e "’’" de fechamento) é corrigido só na pontuação ("“" e "”"); nenhuma palavra muda. "Tt" (por "It") é erro de letra, não de pontuação: o parágrafo sai.
    **Regra f (`smith-daniel` e `egw-thoughts`, conferência em referência externa, só leitura):** parágrafos que o scan deixou ilegíveis (`corrections/*.tsv`, regra `drop`) foram conferidos contra a edição de texto do egwwritings (`text.egwwritings.org`: Daniel and the Revelation, livro 12861; Thoughts From the Mount of Blessing, livro b150), somente para leitura, por trecho, sem baixar livros inteiros, sem gravar páginas, PDFs ou texto deles em disco e sem copiar texto deles. O uso se limita a: (i) reativar o parágrafo quando o próprio scan casa, inequivocamente, com o parágrafo de referência; (ii) registrar palavra a palavra (`original` → `corrigido`) o que o scan trazia quebrado (OCR de letra trocada, palavra partida, lixo entre palavras, grego/hebraico ilegível); e (iii) reativar, sem correção, parágrafos marcados como lixo por falso positivo (abreviação como `A. R. V.,`, `N. Y.,`, `Q.—`), com linha de registro `-1` no TSV. Diferenças de edição (grafia, abreviação, pontuação, números) e palavras que o scan não traz ficam como estão. Parágrafos truncados, com início ou fim fora do casamento, com trecho invertido sem correspondência, ou sem texto na referência consultada, continuam descartados, com o motivo no TSV. Nenhum parágrafo novo entra, e nada além das correções pontuais vem da referência. Marcas no TSV: **f-linha** = correção no início do parágrafo que restaura linha ou capitular perdida pelo OCR (ex.: "W." → "WITH a directness characteristic of the sacred writers,"); **f-original** = palavra grega ou hebraica ilegível no scan, trocada pela forma que a referência traz; **f** = demais correções. A regra também conserta resíduos de parágrafos já publicados (ex.: "HE chronology" → "The chronology"), sempre com casamento inequívoco.
    (d) `egw-great-controversy` usa a edição do Gutenberg (1911), que tem poucas citações no corpo. A edição de
    1895 (Digital Library of India, dli.ernet.236787) tem muito mais citações, mas o OCR troca palavras ("tho" por
    "the", "bo" por "be") em cerca de um terço dos parágrafos com referência. Não foi usada.
    (e) As regras de rodapé de referência (`page_notes`) e de título de seção (`titulos_secao`) e de citação de margem (`citacoes`) valem só para a segunda
    leva. `smith-daniel`, `egw-thoughts` e as demais fontes adventistas antigas continuam como estavam, para o que já
    está publicado não mudar. Em `smith-daniel`, notas de rodapé colocadas no meio do parágrafo ainda podem aparecer no
    texto; conferir antes de uma próxima release.

## 4. Ferramentas e modelos de terceiros (não são dados do banco)

- **Google ML Kit Translation** (tradução inglês -> português no aparelho, opcional). O modelo é baixado pelo
  Google Play Services e não entra no `sensus.db` nem no APK. Sujeito aos termos do Google ML Kit. As traduções
  geradas não são armazenadas (apenas em memória durante a sessão).

## 5. Atualizar este arquivo

Toda nova fonte precisa de `source.json` com `license`, `license_url`, `url`, `version` e `attribution`,
e de uma linha nesta tabela. Só entram fontes cuja licença permita redistribuir o dado derivado.

## 6. Distribuição dos bancos

- **Banco completo** (`data/sensus.db`, build `--edition full`): publicado como ZIP na release `data-<versão>` do
  GitHub (`dist/data/sensus-full-<versão>.zip`, deflate, uma entrada `sensus.db`). O app baixa o ZIP e confere o
  SHA-256 e o tamanho indicados em `data-manifest.json` (raiz do repositório, lido pelo app em `main`).
  Gerado por `pipeline/package_data.py`; a release é criada por `scripts/release-data.sh` (`--dry-run` só mostra o
  comando). O ZIP e o `dist/` não entram no git.
- **Banco leitor** (`data/sensus-reader.db`, build `--edition reader`): empacotado no APK como `app/assets/sensus.db`,
  para o app funcionar offline antes do download. Não é publicado separadamente.
- **Termos de redistribuição do banco completo:** CC BY-SA 4.0 no que deriva do Theographic (regra 1), restrição
  não comercial do RWP (regra 2) e atribuições de cada fonte. As notas da release resumem essas atribuições e
  trazem o aviso CC BY-SA. Cada release nova deve repetir as atribuições e o aviso.
- **Versão dos dados:** `meta.data_version` (AAAA.MM.DD) e `meta.schema_version` (3 desde o layout com `xref`
  compacta e a view `token_strong`). O app aceita só o esquema que conhece (`app/src/data/edition.ts`).
