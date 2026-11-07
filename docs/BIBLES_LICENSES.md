# Licenças das Bíblias (repositório de Bíblias)

Pesquisa feita em 6 de novembro de 2026 e revista na rodada de versificação (TVTMS, SWORD e omissões do texto
crítico) do mesmo dia, para o repositório de Bíblias em 14 idiomas (contrato em
`docs/design/idiomas-biblias-fontes.md`, §2). Fonte preferida: eBible.org, que mostra a licença de cada tradução na
própria página (`https://ebible.org/find/details.php?id=<código>`) e oferece o USFM. Quando a página do eBible não
bastou, conferiu-se a página do titular ou o `.conf` do módulo SWORD (CrossWire).

> Não é parecer jurídico. Itens em **Para decisão** dependem de confirmação humana antes de qualquer publicação.

## 1. Critérios

- **Aceitas:** domínio público (autor e revisores mortos há mais de 70 anos, regra do Brasil; ou texto declarado
  em domínio público pelo titular), CC0, CC BY, CC BY-SA.
- **Recusadas:** NC (não comercial), ND (sem derivados), "uso pessoal", licença própria de sociedade bíblica sem
  permissão de redistribuição, textos marcados como restritos pelo eBible, e textos cuja edição não é a declarada.
- **Versificação (KJV):** o texto é alinhado à KJV e a contagem de versículos de cada capítulo precisa bater com a
  da KJV em pelo menos 99,5% dos capítulos (1189 capítulos: no máximo 5 diferentes). Três regras:
  1. **TVTMS** (`pipeline/bibles/tvtms.py`): numeração de outras tradições (Hebraica, Latina, Grega/LXX) pela
     Translators Versification Traditions with Methodology for Standardisation (STEPBible.org, CC BY 4.0). Títulos de
     salmo que a KJV não numera viram cabeçalho (`heading`) do v.1 da KJV, nunca texto perdido. Texto de versículos
     fundidos vai ao primeiro versículo de destino; os outros ficam numerados sem texto.
  2. **Omissões do texto crítico** (`pipeline/bibles/versification.py`): 16 versículos da KJV que o texto crítico não
     sustenta (Mt 17:21, 18:11, 23:14; Mc 7:16, 9:44, 9:46, 11:26, 15:28; Lc 17:36, 23:17; Jo 5:4; At 8:37, 15:34,
     24:7, 28:29; Rm 16:24). Não contam contra o critério, nem na KJV nem na Bíblia.
  3. **Pontes** (`\v 3-4`): o texto fica no primeiro versículo, com a divisão `bridge` (rótulo "3-4"); os demais
     versículos da ponte continuam numerados, sem texto. A ponte não é numeração faltante.
- **Completude:** os 66 livros do cânon protestante. Bíblia só com Novo Testamento ou com livros faltando é recusada.
  Acréscimos gregos (Ester 10:4–16:24 e outros) não entram: só os versículos da KJV vão ao pacote.
- **Rank 1 do idioma:** licença mais livre, depois texto mais moderno e legível, depois completude.

## 2. Incluídas (empacotadas em `dist/bibles/`)

Todas as Bíblias empacotadas trazem no campo `attribution` a linha da TVTMS (CC BY 4.0), porque a numeração de
todas passa pelo alinhamento. Contagem: capítulos iguais à KJV / 1189.

| Idioma | id | Nome | Licença | URL da licença | Atribuição exigida | Decisão | Motivo |
|---|---|---|---|---|---|---|---|
| en | `engwebp` | World English Bible | Domínio público | https://ebible.org/find/details.php?id=engwebp | "World English Bible (WEB), domínio público (eBible.org)". "World English Bible" é marca do eBible: texto alterado não leva o nome. | Incluída, rank 1 | Domínio público declarado. 1188/1189. |
| en | `engasv` | American Standard Version (1901) | Domínio público | https://ebible.org/find/details.php?id=eng-asv | "American Standard Version (1901), domínio público (eBible.org)." | Incluída, rank 3 | Domínio público. 1189/1189. |
| en | `engbsb` | Berean Standard Bible | Domínio público (dedicada em 30/04/2023) | https://berean.bible/terms.htm | "Berean Standard Bible, domínio público (dedicada em 30/04/2023; eBible.org)." | **Incluída (nova), rank 4** | Antes recusada por versificação. Com as omissões do texto crítico fora da conta: 1189/1189. |
| en | `kjv` | King James Version (SWORD) | Domínio público; módulo declara GPL | (ver DATA_LICENSES.md, item 5) | Já no banco principal. | Incluída no banco principal (`bundled`), rank 2 | Já existente. |
| pt | `blivre` | Bíblia Livre | CC BY 3.0 Brasil | http://creativecommons.org/licenses/by/3.0/br/ | Ver DATA_LICENSES.md (2.4). | Incluída no banco principal (`bundled`), rank 1 | Já existente. |
| es | `spablm` | Santa Biblia libre para el mundo | Domínio público | https://ebible.org/find/details.php?id=spablm | "Santa Biblia libre para el mundo, domínio público (eBible.org)." | Incluída, rank 1 | Domínio público. 1188/1189. |
| es | `spavbl` | Versión Biblia Libre | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Versión Biblia Libre, copyright © 2018-2020 Jonathan Gallagher y Shelly Barrios de Avila, licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 2 | 1189/1189. |
| fr | `frasbl` | Sainte Bible libre pour le monde | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | Não exigida (CC0); citar a origem é boa prática. | Incluída, rank 1 | CC0. 1188/1189. |
| fr | `fralsg` | Louis Segond 1910 | Domínio público | — | "Louis Segond 1910, domínio público (eBible.org)." | **Incluída (nova), rank 2** | Antes recusada por versificação (Salmos, Ex 7/8, Lv 5/6, Nm 16/17, Gn 31/32, Jl, Ml). Alinhada pela TVTMS: 1187/1189. Títulos de salmo viram cabeçalho. |
| fr | `frajnd` | Bible J. N. Darby | Domínio público | — | "Bible J. N. Darby, texto em domínio público (eBible.org)." | **Incluída (nova), rank 3** | Antes recusada por versificação. Alinhada pela TVTMS: 1188/1189. |
| de | `deu1912` | Lutherbibel 1912 | Domínio público | https://ebible.org/find/details.php?id=deu1912 | "Lutherbibel 1912, domínio público (eBible.org)." | Incluída, rank 1 | 1189/1189. |
| de | `deuelo` | Elberfelder 1905 (não revisada) | Domínio público | https://ebible.org/find/details.php?id=deuelo | "Elberfelder 1905 (não revisada), domínio público (eBible.org)." | Incluída, rank 2 | 1189/1189. |
| ar | `arbvd` | Van Dyck (Smith-Van Dyke) | Domínio público | https://ebible.org/find/details.php?id=arb-vd | "Van Dyck (Smith-Van Dyke), domínio público (eBible.org)." | Incluída, rank 1 | 1189/1189. |
| hi | `hin2017` | IRV Hindi 2019 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Indian Revised Version, hindi (2019), copyright © 2017-2019 Bridge Connectivity Solutions, licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 1 | 1189/1189. |
| hi | `hincv` | Hindi Contemporary Version | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Hindi Contemporary Version, copyright © 1978, 2009, 2016, 2019 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org)." | **Incluída (nova), rank 2** | Antes recusada (98,57%): fusões `\v 4-5`, `\v 6-7` etc. Com as pontes: 1189/1189. |
| bn | `benobcv` | Open Bengali Contemporary Version | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Open Bengali Contemporary Version, Copyright © 2007, 2017, 2019 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 1 | 1188/1189. |
| bn | `benirv` | IRV Bengali 2019 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Indian Revised Version, bengali (2019), copyright © 2018-2019 Bridge Connectivity Solutions, licença CC BY-SA 4.0 (eBible.org)." | **Incluída (nova), rank 2** | Antes recusada (99,24%): pontes `\v 10-11`, `\v 43-44` etc. Com as pontes: 1189/1189. |
| ur | `urdoucv` | Urdu Contemporary Version (aberta) | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Urdu Contemporary Version (Biblica), copyright © 1999, 2005, 2022, 2024 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 1 | 1185/1189 (99,66%). |
| ur | `urdirv` | IRV Urdu 2019 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Indian Revised Version, urdu (2019), copyright © 2019 Bridge Connectivity Solutions, licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 2 | 1189/1189. |
| ja | `jpnm` | Freedom Bible (japonês) | Domínio público (sem direitos declarados) | https://ebible.org/find/details.php?id=jpnm | "Freedom Bible (japonês), sem direitos autorais declarados pelo eBible.org." | Incluída, rank 1 | O eBible declara "この聖書翻訳には著作権が設定されていません" (sem direitos autorais definidos). 1188/1189. |
| ru | `russyn` | Синодальный перевод (Sinodal, 1876) | Domínio público | https://ebible.org/find/details.php?id=russyn | "Синодальный перевод (1876), domínio público (eBible.org)." | **Incluída (nova), rank 1** | Licença OK (eBible; módulo SWORD `RusSynodal` também declara domínio público). Antes recusada: a TVTMS e a checagem de texto de Sl (ver §8) mostram o alinhamento correto nos salmos conferidos. 1186/1189 (99,75%). Títulos da Sinodal que não estão na KJV (superscrições da LXX, ex.: "Аллилуия.") entram como cabeçalho sem correspondente na KJV. |
| zh | `cmncbs` | 当代译本开放资源（简体） (Contemporary Chinese Version, simplificado) | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "当代译本开放资源（简体）, Copyright © 1979, 2005, 2007, 2011, 2022 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org)." | **Incluída (nova), rank 1** | Antes recusada (90,66%): fusões `\v 3-4` etc. Com as pontes: 1189/1189. |
| zh | `cmncbt` | 當代譯本開放資源（繁體） (tradicional) | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "當代譯本開放資源（繁體）, Copyright © 1979, 2005, 2007, 2012, 2023 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org)." | **Incluída (nova), rank 2** | Mesmo texto da simplificada, em tradicional. 1189/1189. |
| vi | `vieovcb` | Kinh Thánh Hiện Đại (VCB) | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Kinh Thánh Hiện Đại (VCB), copyright © 1982, 1987, 1994, 2005, 2015 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org)." | **Incluída (nova), rank 1** | Antes recusada (99,24%): as omissões do texto crítico (Mc 7:16 etc.) saem da conta, e 3 Jo 1:15 e Ap 12:18 são alinhados pela TVTMS: 1188/1189. |

## 3. Recusadas

| Idioma | id | Nome | Licença | URL da licença | Atribuição | Decisão | Motivo |
|---|---|---|---|---|---|---|---|
| pt | `porblt` | Bíblia Livre para Todos | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "copyright © 2022 Free Bible Ministry, Inc." | Recusada (completude) | Licença OK, mas o USFM traz só 27 livros (Novo Testamento). |
| es | `sparv1909` | Reina-Valera 1909 (eBible) | Domínio público | https://ebible.org/find/details.php?id=spaRV1909 | "Reina-Valera 1909, domínio público (eBible.org)." | Recusada (lacunas na fonte) | 18 versículos numerados sem texto no USFM do eBible (ex.: Nm 12:16, Nm 29:40, 1Sm 23:29, Jó 40). Ver o item 4 de **Para decisão** (versão SWORD). |
| es | `spav1602p` | Santa Biblia Valera 1602 Purificada | Copyright com restrição: "Prohibida su reproducción con fines de lucro" | https://www.Valera1602.org | — | Recusada (NC) | Proíbe venda e uso com fins de lucro: restrição não comercial. |
| es | `spaLBLA` | La Biblia de las Américas | Restrita no eBible | — | — | Recusada (copyright) | Marcada como restrita. |
| fr | `fraLSG` | — | — | — | — | Incluída como `fralsg` | Ver §2. |
| de | `deutkw` | Textbibel (Kautzsch e Weizsäcker, 1906) | Domínio público | https://ebible.org/find/details.php?id=deutkw | "Textbibel (Kautzsch e Weizsäcker), domínio público (eBible.org)." | Recusada (versificação) | Após a TVTMS: 1179/1189 (99,16%). Restam Ex 5, Dt 5, 2Sm 21, Is 31 e 38, Jn 1, Mt 14, Jo 10 e 15, 1Cr 14, com numeração hebraica não resolvida. A de (Lutherbibel, Elberfelder) já cobre o idioma. |
| de | `deuelbbk` | Elberfelder (bibelkommentare.de) | CC BY-NC-ND 4.0 | http://creativecommons.org/licenses/by-nc-nd/4.0/ | "copyright © 2019 Verbreitung des christlichen Glaubens e.V." | Recusada (NC, ND) | Não comercial e sem derivados. |
| ru | `rusfb` | Библия свободы (Freedom Bible) | Domínio público | https://ebible.org/find/details.php?id=rusfb | — | Recusada (completude e rascunho) | 36 livros e o próprio texto diz ser "черновой вариант" (rascunho). |
| zh | `cu89s` / `cu89t` | 新标点和合本 (simplificado / tradicional) | eBible: domínio público; a revisão de 1989 é de titularidade incerta (a Hong Kong Bible Society aparece como agente de direitos) | https://ebible.org/find/details.php?id=cmn-cu89s | — | **Para decisão** (item 2) | Titularidade incerta. Além disso, 94,53% de versificação antes da TVTMS. |
| zh | `ChiUn` / `ChiUns` (SWORD) | 和合本 (繁體字 / 简体字) | SWORD: "Public Domain"; About: "最早於1919年出版" | http://bible.fhl.net | — | **Não usada** (item 2) | O SWORD declara a edição de 1919, mas o texto tem a pontuação moderna (a edição de 1919 não tinha pontuação): 30800 de 31102 versículos com pontuação, e Jo 3:16 com "不致灭亡", leitura da revisão de 1989. |
| zh | `cmnfeb` | Free Easy-to-read Bible | Não verificada | — | — | Recusada (completude) | Só Novo Testamento (27 livros). |
| zh | `cmn-ncvs` / `cmn-ncvt` | 新译本 | Restrita no eBible | — | — | Recusada (copyright) | Marcada como restrita. |
| bn | `ben2006` | Bengali Bible (ERV) | Restrita no eBible | — | — | Recusada (copyright) | Marcada como restrita. |
| ur | `urdgvu` / `urdgvh` / `urdgvr` | Urdu Geo Bible | Não verificada | — | — | Não verificada | Não examinada: a IRV e a Contemporary cobrem o idioma. |
| id | `indtsi` | Terjemahan Sederhana Indonesia (TSI) | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "© 2021 Yayasan Alkitab Bahasa Kita (Albata) dan Pioneer Bible Translators International." | Recusada (completude) | O USFM traz 48 livros. Faltam 18, entre eles Salmos, Jó, Jeremias, Ezequiel, Daniel, 1Crônicas e 2Crônicas. |
| id | `indayt` | Alkitab Yang Terbuka (AYT) | Contraditória: a página cita CC BY-NC, CC BY-ND e CC BY-NC-SA | https://creativecommons.org/licenses/by-nc/4.0/ | "AYT - text is Copyrighted, YLSA-AYT 2011,2024©" | Recusada (NC) | Não comercial e a própria página não resolve a licença. |
| id | `indags` | Alkitab Gratis untuk Semua | Não verificada | — | — | Recusada (completude) | Só Novo Testamento (27 livros). |
| id | `IndBIS` (SWORD) | Bahasa Indonesia Sehari-hari | — | — | — | Não usada | O zip no CrossWire está vazio (22 bytes). |
| vi | `vie1934` | Kinh Thánh (eBible: "Vietnamese Bible 1923") | Domínio público (eBible) | https://ebible.org/find/details.php?id=vie1934 | "Kinh Thánh, domínio público (eBible.org)." | **Fica de fora** (decisão do responsável; item 1) | Edição de 1925 (AT) e 1923 (NT); colaboradores (Phan Khôi, falecido em 1959) mantêm o AT protegido no Brasil. |
| vi | `Viet` (SWORD) | Kinh Thánh Tiếng Việt (1934) | SWORD: "Public Domain" | — | — | Fica de fora (mesma decisão) | Mesma família de edição da `vie1934`. |
| vi | `vie2011` | Thánh Kinh Bản Phổ thông | Restrita no eBible | — | — | Recusada (copyright) | Marcada como restrita. |
| vi | `VieLCCMN` / `VieLCCMNCT` / `VietNVB` (SWORD) | Lời Chúa Cho Mọi Người; New Vietnamese Bible (2002) | SWORD: "Copyrighted; Permission to distribute granted to CrossWire" | — | — | Recusadas (copyright) | Permissão concedida ao CrossWire, não licença de redistribuição. |
| ja | `jpn1965` | Shinkaiyaku (NT 1965) | Não verificada | — | — | Não usada | Só Novo Testamento. A Freedom Bible cobre o idioma. |
| pt | `porbrbsl` / `portft` / `poronbv` | Outras portuguesas | Não verificadas | — | — | Não usadas | A Bíblia Livre (já no banco principal) cobre o idioma. |

## 4. Cobertura por idioma

| Idioma | Bíblias incluídas (rank 1 primeiro) | Situação |
|---|---|---|
| pt | Bíblia Livre (no banco principal) | Coberto |
| en | World English Bible; KJV (banco principal); American Standard Version 1901; Berean Standard Bible | Coberto |
| es | Santa Biblia libre para el mundo; Versión Biblia Libre | Coberto |
| fr | Sainte Bible libre pour le monde; Louis Segond 1910; Darby | Coberto |
| de | Lutherbibel 1912; Elberfelder 1905 | Coberto |
| ar | Van Dyck (Smith-Van Dyke) | Coberto |
| hi | IRV Hindi 2019; Hindi Contemporary Version | Coberto |
| bn | Open Bengali Contemporary Version; IRV Bengali 2019 | Coberto |
| ur | Urdu Contemporary Version; IRV Urdu 2019 | Coberto |
| ja | Freedom Bible | Coberto |
| zh | Contemporary Chinese Version (simplificado e tradicional), CC BY-SA 4.0 | Coberto (não é a União de 1919 nem a de 1989) |
| vi | Kinh Thánh Hiện Đại (VCB), CC BY-SA 4.0 | Coberto |
| ru | Синодальный перевод (Sinodal), domínio público | Coberto |
| id | — | **Sem Bíblia aprovada** (nenhuma completa e livre encontrada; item 6) |

Treze de catorze idiomas têm pelo menos uma Bíblia empacotada. Só o indonésio fica sem Bíblia.

## 5. Omissões, pontes e títulos: como ficam no pacote

- **Omissões do texto crítico** (16 versículos, §1): fora da conta. No pacote, o versículo não existe quando a
  tradução não o tem, e fica sem texto quando a tradução o numera vazio.
- **Pontes** (`\v 3-4`): `text_division` com `kind = 'bridge'` e `title = '3-4'` no primeiro versículo. O segundo
  versículo da ponte não tem linha de texto, e o leitor mostra "3-4" no lugar do número.
- **Títulos de salmo**: `text_division` com `kind = 'heading'` no v.1 da KJV. Os títulos que a tradução numera como
  versículo (Hebraica, LXX) são movidos para o cabeçalho, e o texto deles não entra na contagem.
- **Versículos fundidos** (ex.: Gn 5:32/6:1 na Grega): o texto fica no primeiro versículo da KJV e o restante do
  intervalo fica numerado sem texto. A posição exata do trecho fundido não é reconstruída (sem subversículos).
- **Acréscimos fora do cânon** (Ester 11–16 gregos, Daniel grego, Salmo 151 e outros): não entram no pacote.

## 6. Para decisão humana

1. **Vietnamita 1925 (`vie1934`) e SWORD `Viet` (1934):** decisão do responsável: **ficam de fora**. O colaborador
   Phan Khôi morreu em 1959; pela regra do Brasil (vida + 70) a obra só entra em domínio público em 2030.
2. **Chinês: CUV 1919 não encontrada.** O eBible `cu89s/cu89t` é a revisão de 1989 (titularidade incerta). O SWORD
   `ChiUn`/`ChiUns` diz ser de 1919, mas o texto tem a pontuação moderna e a leitura da revisão de 1989: não é usado.
   Falta uma fonte da edição de 1919 sem pontuação, com licença comprovada (ex.: transcrição em domínio público).
3. **Sinodal (`russyn`): incluída, com ressalva de títulos.** Conferida à mão: Sl 3:1, 13:1, 51:1, 87:1, 90:1, 119:176 e 146:1 estão certos, e a checagem de texto acusa Sl 13, 82, 87 e 120, todos revisados à mão sem deslocamento. Há divergências de cabeçalho (27 salmos, sobretudo 90–150) em que a Sinodal traz superscrições da LXX que a KJV não tem; o texto dos versículos não está afetado. Se o responsável preferir, excluir a Sinodal do catálogo volta a deixar o russo sem Bíblia.
4. **Reina-Valera 1909 (SWORD `SpaRV1909`): fica de fora.** O módulo declara "Copyrighted; Permission to distribute granted to CrossWire" e o "About" diz que o texto é de domínio público. Licença contraditória: não entra.
5. **Berean Standard Bible (`engbsb`):** incluída pelo critério (domínio público declarado em 30/04/2023). Confirmar a
   declaração no site do titular antes da próxima release.
6. **Indonésio:** não há Bíblia completa e livre encontrada (TSI incompleta; AYT NC; IndBIS vazia). Klinkert (1879) e
   Shellabear não aparecem no eBible nem no SWORD. Sugestão: procurar digitalização de domínio público com revisão.
7. **Textbibel (`deutkw`):** 99,16%, abaixo do critério. Fica de fora até a numeração hebraica de Ex 5, Dt 5 etc.
   ser conferida.

## 7. Atribuição e distribuição

- As Bíblias em CC BY e CC BY-SA exigem crédito. O app mostra a atribuição de cada Bíblia instalada (campo
  `attribution` do manifesto) na tela "Sobre e licenças".
- Toda Bíblia empacotada com alinhamento pela TVTMS traz, na atribuição, o crédito exigido pela CC BY 4.0 da TVTMS
  (STEP Bible, Tyndale House, Cambridge). O arquivo da TVTMS não é redistribuído: fica em `data/raw/bibles/tvtms/` e
  não entra no git.
- O pacote SQLite de cada Bíblia grava `license` e `attribution` na tabela `meta`.
- Versículos sem texto na tradução (variantes textuais, como At 8:37) não entram no pacote; o app mostra a lacuna.
- Os 16 versículos do texto crítico não são acrescentados às traduções que não os têm.


## 8. Checagem de texto e de título (salmos)

Além da contagem (1189 capítulos), cada Bíblia alinhada pela TVTMS passa por duas checagens informativas (`pipeline/bibles/versification.py`, `text_check` e `title_check`). Elas não usam o idioma:

- **Texto:** o comprimento (letras) de cada versículo alinhado deve acompanhar o da KJV no mesmo versículo. Acusa um capítulo quando outro deslocamento (−1 ou +1) explica melhor o texto, quando a correlação é baixa, ou quando o primeiro/último versículo sai da faixa de 0,5 a 2 vezes o esperado.
- **Título:** a KJV marca o título com linha em branco antes do v.1. Acusa salmo com título na KJV e sem cabeçalho no v.1 da Bíblia, e o inverso.

Resultado (salmos acusados / conferidos à mão):

| Bíblia | Acusados (texto) | Título: divergências | Leitura à mão |
|---|---|---|---|
| `russyn` (Sinodal) | 4: 13, 82, 87, 120 | 27 | 13, 87 e 120 certos (87: texto de 87:1–2 fundido no v.1, como documentado); 82 certo nos versículos 1–2 |
| `fralsg` (LSG 1910) | 7: 13, 58, 66, 114, 120, 121, 129 | 54 (títulos fundidos ao v.1) | Todos falsos positivos: título no próprio texto do v.1, ou versículo curto |
| `frajnd` (Darby) | 6: 13, 60, 87, 113, 120, 121 | 54 | Todos falsos positivos (título fundido; Sl 113 com "Louez Jah" correto) |

As regras da TVTMS e a regra 'título como versículo' (`title_as_verse`) mudam a numeração de LSG e Darby em zero versículos. Na Sinodal mudam 10 versículos em Sl 13, 87 e 90, que foram conferidos à mão.

Limitação: o texto fundido (ex.: Sl 89:6 da Sinodal, que cobre Sl 90:5–6) fica no primeiro versículo da KJV. A checagem por comprimento não separa esse trecho; é aceito pela regra documentada em §5.
