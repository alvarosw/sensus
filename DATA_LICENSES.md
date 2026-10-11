# Licenças dos dados

Este arquivo lista todas as fontes de dados do Sensus, com licença, origem e atribuição exigida.
Foi montado a partir dos metadados de `data/staging/*/source.json` (31 fontes). O banco `sensus.db`
grava licença, URL, versão e atribuição de cada fonte na tabela `source`.

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
5. **Fontes fora do build atual.** `data/sensus.db` hoje tem 27 das 31 fontes. Estão em staging,
   mas fora do build: `hbo-wlc`, `tahot`, `stepbible-tbesh`, `sword-kd`. Elas entram no próximo build
   e precisam da mesma atribuição.

## 2. Fontes

### 2.1 CC BY-SA 4.0

| Fonte (id) | Título e autor | Origem | Atribuição exigida | Condições |
|---|---|---|---|---|
| `theographic` | Theographic Bible Metadata, Robert Rouse (viz.bible) | https://github.com/robertrouse/theographic-bible-metadata (commit cfb1c48) | Theographic Bible Metadata, por Robert Rouse / viz.bible (https://github.com/robertrouse/theographic-bible-metadata), licença Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). | **Share-alike.** Descrições vêm de dictionaryText, em inglês, e incluem texto do Easton (1897, domínio público). Links Markdown removidos. |

### 2.2 CC BY 4.0 — STEP Bible / Tyndale House

Atribuição comum: *Dados criados por STEP Bible (www.STEPBible.org), baseados em trabalho da Tyndale House
Cambridge. Licença CC BY 4.0: credite "STEP Bible" com link para www.STEPBible.org.*
(Fonte do repositório: https://github.com/STEPBible/STEPBible-Data, commit dd88ab3.)

| Fonte (id) | Título | Condições |
|---|---|---|
| `tagnt` | Translators Amalgamated Greek NT (TAGNT) | Inclui tokens sintéticos para leituras alternativas (TR/BYZ). |
| `grc-tr` | Textus Receptus, derivado do TAGNT | Palavras marcadas como presentes no TR. |
| `tahot` | Translators Amalgamated Hebrew OT (TAHOT) | **Fora do build atual.** Base Leningrado, com correções da STEPBible. |
| `hbo-wlc` | Hebraico do AT (Leningrado), derivado do TAHOT | **Fora do build atual.** Mesma base do TAHOT. |
| `stepbible-tbesg` | TBESG, léxico grego | Definições baseadas em Abbott-Smith, editadas pela STEPBible. |
| `stepbible-tbesh` | TBESH, léxico hebraico | **Fora do build atual.** Definições baseadas em BDB (abreviado). |
| `stepbible-tflsj` | TFLSJ, LSJ formatado | Base Liddell-Scott-Jones (domínio público), formatada pela Tyndale House. |
| `stepbible-tipnr` | TIPNR, nomes próprios | Coordenadas via OpenBible.info, ver item 4 de "Verificar". |

### 2.3 CC BY 4.0 — OpenBible.info

| Fonte (id) | Título | Origem | Atribuição exigida | Condições |
|---|---|---|---|---|
| `openbible-geo` | OpenBible.info Bible Geocoding Data | https://github.com/openbibleinfo/Bible-Geocoding-Data (commit 7eb18a5) | Bible geocoding data: OpenBible.info (https://www.openbible.info/geo/), licença Creative Commons Attribution 4.0 (CC BY 4.0). | **Verificar ODbL** (item 4). Textos em inglês, não traduzidos. |
| `openbible-xref` | OpenBible.info Cross References | https://www.openbible.info/labs/cross-references/ (data 2026-10-05) | Referências cruzadas: OpenBible.info (https://www.openbible.info/labs/cross-references/), licença CC BY 4.0. | Só atribuição, sem share-alike. Peso pode ser negativo. Sem remapeamento para KJV. |

### 2.4 CC BY 3.0 Brasil

| Fonte (id) | Título | Origem | Atribuição exigida | Condições |
|---|---|---|---|---|
| `blivre` | Bíblia Livre (porbr2018), Diego Santos, Mario Sérgio, Marco Teles | https://ebible.org/find/details.php?id=porbr2018 ; repositório blivre/BibliaLivre (LICENCA.md) | Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - fevereiro de 2018. Licença Creative Commons Atribuição 3.0 Brasil (http://creativecommons.org/licenses/by/3.0/br/). | Usa a licença 3.0 do LICENCA.md do projeto. O eBible cita 4.0 Brasil. As duas exigem atribuição. Notas de rodapé e referências removidas. |

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
| `sword-kd` | Keil e Delitzsch (1864) | Biblical Commentary on the Old Testament | v2.0 | PD. **Fora do build atual.** |
| `sword-mhc` | Matthew Henry (1662-1714) | Complete Commentary on the Whole Bible | v2.2 | PD. Texto do CCEL. |
| `sword-scofield` | C. I. Scofield (1843-1921) | Reference Notes, edição de 1917 | v2.1 | PD. |
| `sword-wesley` | John Wesley (1703-1791) | Notes on the Bible | v1.1 | PD. |

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

## 3. Verificar antes de distribuir

1. **RWP (`sword-rwp`).** Manter ou excluir é decisão do responsável. Se mantido, o app precisa exibir
   a restrição não comercial. O "About" do módulo cita expiração em 2006/2007, e isso parece
   desatualizado. Nos EUA, obras publicadas em 1932-1933 e renovadas costumam ter proteção de 95 anos,
   o que levaria a 2028-2029. No Brasil, Robertson (falecido em 1934) está em domínio público pela regra
   de vida mais 70 anos. Confirmar a jurisdição aplicável.
2. **Banco misto (`sensus.db`).** Os termos de cada fonte ficam no `source`. Antes de publicar o banco,
   decidir entre (a) excluir o RWP do build distribuído ou (b) distribuir o banco com aviso explícito de
   que as linhas do RWP são só para uso não comercial. Recomenda-se revisão jurídica.
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
9. **ISBE.** Confirmar que o módulo é da edição de 1915, em domínio público. Edições posteriores podem
   ter proteção.
10. **Fontes fora do build.** Ao incluir `tahot`, `hbo-wlc`, `stepbible-tbesh` e `sword-kd`, atualizar a
    tela de licenças e este arquivo.

## 4. Atualizar este arquivo

Toda nova fonte precisa de `source.json` com `license`, `license_url`, `url`, `version` e `attribution`,
e de uma linha nesta tabela. Só entram fontes cuja licença permita redistribuir o dado derivado.
