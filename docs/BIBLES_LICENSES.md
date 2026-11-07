# Licenças das Bíblias (repositório de Bíblias)

Pesquisa feita em 6 de novembro de 2026 para o repositório de Bíblias em 14 idiomas (contrato em
`docs/design/idiomas-biblias-fontes.md`, §2). Fonte preferida: eBible.org, que mostra a licença de cada tradução na
própria página (`https://ebible.org/find/details.php?id=<código>`) e oferece o USFM. Quando a página do eBible não
bastou, conferiu-se a página do titular.

> Não é parecer jurídico. Itens em **Para decisão** dependem de confirmação humana antes de qualquer publicação.

## 1. Critérios

- **Aceitas:** domínio público (autor e revisores mortos há mais de 70 anos, regra do Brasil; ou texto declarado
  em domínio público pelo titular), CC0, CC BY, CC BY-SA.
- **Recusadas:** NC (não comercial), ND (sem derivados), "uso pessoal", licença própria de sociedade bíblica sem
  permissão de redistribuição, e textos marcados como restritos pelo eBible.
- **Versificação (KJV):** pelo menos 99,5% dos capítulos com a mesma contagem de versículos da KJV, contando
  versículos numerados, mesmo sem texto (ver `pipeline/bibles/versification.py`). Abaixo disso, a Bíblia não é
  empacotada. Nenhum mapeamento de numeração foi aplicado às Bíblias incluídas: todas passam sem ele.
- **Completude:** os 66 livros do cânon protestante. Bíblia só com Novo Testamento ou com livros faltando é recusada.
- **Rank 1 do idioma:** licença mais livre, depois texto mais moderno e legível, depois completude.

## 2. Incluídas (empacotadas em `dist/bibles/`)

| Idioma | id | Nome | Licença | URL da licença | Atribuição exigida | Decisão | Motivo |
|---|---|---|---|---|---|---|---|
| en | `engwebp` | World English Bible | Domínio público | https://ebible.org/find/details.php?id=engwebp | "World English Bible (WEB), domínio público (eBible.org)". "World English Bible" é marca do eBible: texto alterado não leva o nome. | Incluída, rank 1 | Domínio público declarado. 99,83% dos capítulos; 5 versículos numerados sem texto (variantes textuais). |
| en | `engasv` | American Standard Version (1901) | Domínio público | https://ebible.org/find/details.php?id=eng-asv | "American Standard Version (1901), domínio público (eBible.org)". | Incluída, rank 3 | Domínio público. 100% dos capítulos; 16 versículos numerados sem texto. |
| en | `kjv` | King James Version (SWORD) | Domínio público; módulo declara GPL | (ver DATA_LICENSES.md, item 5) | Já no banco principal. | Incluída no banco principal (`bundled`), rank 2 | Já existente. |
| pt | `blivre` | Bíblia Livre | CC BY 3.0 Brasil | http://creativecommons.org/licenses/by/3.0/br/ | Ver DATA_LICENSES.md (2.4). | Incluída no banco principal (`bundled`), rank 1 | Já existente. |
| es | `spablm` | Santa Biblia libre para el mundo | Domínio público | https://ebible.org/find/details.php?id=spablm | "Santa Biblia libre para el mundo, domínio público (eBible.org)". | Incluída, rank 1 | Domínio público. 99,83%; 5 versículos sem texto (variantes textuais). |
| es | `spavbl` | Versión Biblia Libre | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Versión Biblia Libre, copyright © 2018-2020 Jonathan Gallagher y Shelly Barrios de Avila, licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 2 | 100% dos capítulos; 16 versículos sem texto. |
| fr | `frasbl` | Sainte Bible libre pour le monde | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | Não exigida (CC0); citar a origem é boa prática. | Incluída, rank 1 | CC0. 99,83%; 5 versículos sem texto. |
| de | `deu1912` | Lutherbibel 1912 | Domínio público | https://ebible.org/find/details.php?id=deu1912 | "Lutherbibel 1912, domínio público (eBible.org)". | Incluída, rank 1 | Domínio público declarado. 100%. |
| de | `deuelo` | Elberfelder 1905 (não revisada) | Domínio público | https://ebible.org/find/details.php?id=deuelo | "Elberfelder 1905 (não revisada), domínio público (eBible.org)". | Incluída, rank 2 | Domínio público declarado (edição de 1905). 100%. |
| ar | `arbvd` | Van Dyck (Smith-Van Dyke) | Domínio público | https://ebible.org/find/details.php?id=arb-vd | "Van Dyck (Smith-Van Dyke), domínio público (eBible.org)." | Incluída, rank 1 | Domínio público declarado (tradução do século XIX). 99,83%. |
| hi | `hin2017` | IRV Hindi 2019 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Indian Revised Version, hindi (2019), copyright © 2017-2019 Bridge Connectivity Solutions, licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 1 | CC BY-SA. 99,83%. |
| bn | `benobcv` | Open Bengali Contemporary Version | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Open Bengali Contemporary Version, Copyright © 2007, 2017, 2019 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 1 | CC BY-SA. 99,66%. |
| ur | `urdoucv` | Urdu Contemporary Version (aberta) | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Urdu Contemporary Version (Biblica), copyright © 1999, 2005, 2022, 2024 Biblica, Inc., licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 1 | CC BY-SA. 99,58% (limite: 5 capítulos de diferença). |
| ur | `urdirv` | IRV Urdu 2019 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Indian Revised Version, urdu (2019), copyright © 2019 Bridge Connectivity Solutions, licença CC BY-SA 4.0 (eBible.org)." | Incluída, rank 2 | CC BY-SA. 99,83%; 1 versículo sem texto (Ap 12:18). |
| ja | `jpnm` | Freedom Bible (japonês) | Domínio público (sem direitos declarados) | https://ebible.org/find/details.php?id=jpnm | "Freedom Bible (japonês), sem direitos autorais declarados pelo eBible.org." | Incluída, rank 1 | O eBible declara "この聖書翻訳には著作権が設定されていません" (sem direitos autorais definidos). 99,83%. Única opção de tradução completa encontrada em japonês. |

## 3. Recusadas

| Idioma | id | Nome | Licença | URL da licença | Atribuição | Decisão | Motivo |
|---|---|---|---|---|---|---|---|
| en | `engbsb` | Berean Standard Bible | Domínio público (dedicada em 30/04/2023) | https://berean.bible/terms.htm | — | Recusada (versificação) | Licença OK. 98,74%: 15 capítulos sem versículos que a tradução omite (Mt 17:21, Mt 18:11, Mt 23:14, Mc 7:16, Mc 9:44, Lc 17:36, At 8:37 etc.). Não há mapeamento: o texto não existe. Se aceitarem Bíblia com lacunas, pode entrar. |
| pt | `porblt` | Bíblia Livre para Todos | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "copyright © 2022 Free Bible Ministry, Inc." | Recusada (completude) | Licença OK, mas o USFM traz só 27 livros (Novo Testamento). |
| es | `sparv1909` | Reina-Valera 1909 | Domínio público | https://ebible.org/find/details.php?id=spaRV1909 | "Reina-Valera 1909, domínio público (eBible.org)." | Recusada (lacunas na fonte) | Licença OK e 100% de numeração, mas 18 versículos numerados estão vazios no USFM do eBible (ex.: Nm 12:16, Nm 29:40, 1Sm 23:29, Jó 40). Lacuna de fonte, não de texto original. Pode ser reavaliada com outra fonte. |
| es | `spav1602p` | Santa Biblia Valera 1602 Purificada | Copyright com restrição: "Prohibida su reproducción con fines de lucro" | https://www.Valera1602.org | — | Recusada (NC) | Proíbe venda e uso com fins de lucro: restrição não comercial. |
| es | `spaLBLA` | La Biblia de las Américas | Restrita no eBible | — | — | Recusada (copyright) | Marcada como restrita. |
| fr | `fraLSG` | Louis Segond 1910 | Domínio público | https://ebible.org/find/details.php?id=fraLSG | "Louis Segond 1910, domínio público (eBible.org)." | Recusada (versificação) | Licença OK. 91,08%: Salmos com título como versículo 1 e numeração hebraica em Ex 7/8, Lv 5/6, Nm 16/17, Gn 31/32, Jl, Ml (106 capítulos). Mapeamento exigiria tabela de numeração revisada. |
| fr | `frajnd` | Bible J. N. Darby | Domínio público | https://ebible.org/find/details.php?id=frajnd | "Bible J. N. Darby, texto em domínio público (eBible.org)." | Recusada (versificação) | Mesmos padrões de numeração de LSG. 88,06%. |
| de | `deutkw` | Textbibel (Kautzsch e Weizsäcker, 1906) | Domínio público | https://ebible.org/find/details.php?id=deutkw | "Textbibel (Kautzsch e Weizsäcker), domínio público (eBible.org)." | Recusada (versificação) | 87,47%: Salmos e numeração hebraica. |
| de | `deuelbbk` | Elberfelder (bibelkommentare.de) | CC BY-NC-ND 4.0 | http://creativecommons.org/licenses/by-nc-nd/4.0/ | "copyright © 2019 Verbreitung des christlichen Glaubens e.V." | Recusada (NC, ND) | Não comercial e sem derivados. |
| ru | `russyn` | Синодальный перевод (Sinodal) | Domínio público | https://ebible.org/find/details.php?id=russyn | "Синодальный перевод, domínio público (eBible.org)." | Recusada (versificação) | Licença OK. 85,53%: Salmos na numeração da Septuaginta (ex.: Sl 9 com 39 versículos, fusões de 9/10, 114/115, 146/147). Exige mapeamento verso a verso da LXX, não feito. **Para decisão**: aceitar um mapeamento verificado. Russo fica sem Bíblia. |
| ru | `rusfb` | Библия свободы (Freedom Bible) | Domínio público | https://ebible.org/find/details.php?id=rusfb | — | Recusada (completude e rascunho) | 36 livros e o próprio texto diz ser "черновой вариант" (rascunho). |
| zh | `cmncbs` | 当代译本开放资源（简体） | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Copyright © 1979, 2005, 2007, 2011, 2022 Biblica, Inc." | Recusada (versificação) | Licença OK. 90,66%: versículos fundidos (`\v 3-4` etc.) e Salmos. |
| zh | `cmncbt` | 當代譯本開放資源（繁體） | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Copyright © 1979, 2005, 2007, 2012, 2023 Biblica, Inc." | Recusada (versificação) | Mesma numeração da simplificada: 90,66%. |
| zh | `cu89s` / `cu89t` | 新标点和合本 (simplificado / tradicional) | eBible: domínio público; a revisão de 1989 é de titularidade incerta (a Hong Kong Bible Society aparece como agente de direitos) | https://ebible.org/find/details.php?id=cmn-cu89s | — | **Para decisão** | Licença incerta (a União Versão de 1919 é de domínio público; a revisão de 1989 não). Além disso, 94,53% de versificação, abaixo do critério. Chinês fica sem Bíblia até decisão. |
| zh | `cmnfeb` | Free Easy-to-read Bible | Não verificada | — | — | Recusada (completude) | Só Novo Testamento (27 livros). |
| zh | `cmn-ncvs` / `cmn-ncvt` | 新译本 | Restrita no eBible | — | — | Recusada (copyright) | Marcada como restrita. |
| hi | `hincv` | Hindi Contemporary Version | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "copyright © 1978, 2009, 2016, 2019 Biblica, Inc." | Recusada (versificação) | 98,57%: 17 capítulos (fusões `\v 4-5`, `\v 6-7` etc.). A IRV de 2019 (incluída) cobre o idioma. |
| bn | `benirv` | IRV Bengali 2019 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "copyright © 2018-2019 Bridge Connectivity Solutions." | Recusada (versificação) | 99,24%: 9 capítulos com fusões de versículos (`\v 10-11`, `\v 43-44` etc.). Acima do limite com 5 capítulos de folga, não com 9. |
| bn | `ben2006` | Bengali Bible (ERV) | Restrita no eBible | — | — | Recusada (copyright) | Marcada como restrita. |
| ur | `urdgvu` / `urdgvh` / `urdgvr` | Urdu Geo Bible | Não verificada | — | — | Não verificada | Não examinada: a IRV e a Contemporary cobrem o idioma. |
| id | `indtsi` | Terjemahan Sederhana Indonesia (TSI) | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "© 2021 Yayasan Alkitab Bahasa Kita (Albata) dan Pioneer Bible Translators International." | Recusada (completude) | O USFM traz 48 livros. Faltam 18, entre eles Salmos, Jó, Jeremias, Ezequiel, Daniel, 1Crônicas e 2Crônicas. Licença OK. |
| id | `indayt` | Alkitab Yang Terbuka (AYT) | Contraditória: a página cita CC BY-NC, CC BY-ND e CC BY-NC-SA | https://creativecommons.org/licenses/by-nc/4.0/ | "AYT - text is Copyrighted, YLSA-AYT 2011,2024©" | Recusada (NC) | Não comercial e a própria página não resolve a licença. |
| id | `indags` | Alkitab Gratis untuk Semua | Não verificada | — | — | Recusada (completude) | Só Novo Testamento (27 livros). |
| vi | `vieovcb` | Kinh Thánh Hiện Đại (VCB) | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | "Copyright © 1982, 1987, 1994, 2005, 2015 Biblica, Inc." | Recusada (versificação) | 99,24%: 9 capítulos com versículos ausentes no Novo Testamento (Mc 7:16, Mc 9:44 etc.), contados como numeração faltante. |
| vi | `vie1934` | Kinh Thánh (1923 NT / 1925 AT; eBible: "Vietnamese Bible 1923") | Domínio público (eBible); NT em domínio público nos EUA desde 2019 | https://ebible.org/find/details.php?id=vie1934 | "Kinh Thánh, domínio público (eBible.org)." | **Para decisão** | 100% de versificação e USFM completo. Dúvida de titularidade pela regra do Brasil: William Cadman (1883–1948) é o tradutor principal; o AT de 1925 foi concluído com a colaboração de Phan Khôi (falecido, segundo consta, em 1959, o que deixaria o AT protegido no Brasil até 2029). Confirmar a morte dos colaboradores. Vietnamita fica sem Bíblia até decisão. |
| vi | `vie2011` | Thánh Kinh Bản Phổ thông | Restrita no eBible | — | — | Recusada (copyright) | Marcada como restrita. |
| ja | `jpn1965` | Shinkaiyaku (NT 1965) | Não verificada | — | — | Não usada | Só Novo Testamento. A Freedom Bible cobre o idioma. |
| pt | `porbrbsl` / `portft` / `poronbv` | Outras portuguesas | Não verificadas | — | — | Não usadas | A Bíblia Livre (já no banco principal) cobre o idioma. |

## 4. Cobertura por idioma

| Idioma | Bíblias incluídas (rank 1 primeiro) | Situação |
|---|---|---|
| pt | Bíblia Livre (no banco principal) | Coberto |
| en | World English Bible; KJV (banco principal); American Standard Version 1901 | Coberto |
| es | Santa Biblia libre para el mundo; Versión Biblia Libre | Coberto |
| fr | Sainte Bible libre pour le monde | Coberto |
| de | Lutherbibel 1912; Elberfelder 1905 | Coberto |
| ar | Van Dyck (Smith-Van Dyke) | Coberto |
| hi | IRV Hindi 2019 | Coberto |
| bn | Open Bengali Contemporary Version | Coberto |
| ur | Urdu Contemporary Version; IRV Urdu 2019 | Coberto |
| ja | Freedom Bible | Coberto |
| zh | — | **Sem Bíblia aprovada** (CUV 1989 para decisão; CBS/CBT pela versificação) |
| ru | — | **Sem Bíblia aprovada** (Sinodal para decisão: numeração LXX dos Salmos) |
| id | — | **Sem Bíblia aprovada** (TSI incompleta; AYT é NC) |
| vi | — | **Sem Bíblia aprovada** (1925 para decisão: colaboradores) |

Dez de catorze idiomas têm pelo menos uma Bíblia empacotada.

## 5. Para decisão humana

1. **Vietnamita 1925 (`vie1934`):** confirmar a morte de Phan Khôi e dos outros colaboradores do AT. Se todos morreram há mais de 70 anos, entra como domínio público.
2. **Chinês CUV 1989 (`cu89s`/`cu89t`):** confirmar a titularidade da revisão de 1989 com a Hong Kong Bible Society. A versificação (94,53%) também fica abaixo do critério.
3. **Russo Sinodal (`russyn`):** aceitar um mapeamento verificado da numeração da LXX (Salmos), ou aceitar a Sinodal sem os Salmos mal numerados.
4. **Berean Standard Bible (`engbsb`):** a licença está ok; a versificação não. Decidir se Bíblia com 15 capítulos incompletos pode entrar.
5. **Reina-Valera 1909 (`sparv1909`):** 18 versículos vazios no USFM do eBible. Buscar outra cópia ou aceitar as lacunas.

## 6. Atribuição e distribuição

- As Bíblias em CC BY e CC BY-SA exigem crédito. O app mostra a atribuição de cada Bíblia instalada (campo
  `attribution` do manifesto) na tela "Sobre e licenças".
- O pacote SQLite de cada Bíblia grava `license` e `attribution` na tabela `meta`.
- Versículos sem texto na tradução (variantes textuais, como At 8:37) não entram no pacote; o app mostra a lacuna.
- Mapeamentos de numeração não foram aplicados. Se forem aprovados no futuro, entram em
  `pipeline/bibles/versification.py` com testes e nova rodada de empacotamento.
