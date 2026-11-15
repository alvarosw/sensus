# Pacotes por língua e traduções do conteúdo: contratos

Documento de trabalho (novembro de 2026). Define como o banco de estudo deixa de ser um arquivo único e passa a ser
baixado em pacotes por língua, e por qual caminho cada texto em inglês chega traduzido às línguas do app. Continua
[idiomas-biblias-fontes.md](idiomas-biblias-fontes.md) (idiomas, Bíblias em pacotes, preferência de fontes). Regras
gerais em [ARCHITECTURE.md](../ARCHITECTURE.md).

## 0. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Unidade de download | Pacotes: **base** (sem língua), **língua** (`lang-<xx>`, textos curtos) e **edição** (uma por fonte). Bíblias continuam como estão. | Hoje é um ZIP único (~505 MB): qualquer correção baixa tudo de novo e quem usa uma língua baixa o que não lê. |
| Obra e edição | `source.work` agrupa as edições de uma mesma obra; `source.lang` diz a língua de cada edição. | Permite ter a mesma obra em pt e en e baixar só a que vale. |
| Escolha da edição | A da língua do app; senão a primeira da `fallbackChain` (idioma → en → pt). As demais edições da obra não baixam. | Mesma cadeia já decidida para os textos da interface. |
| Pacote de língua | **Resolvido no pipeline**: para cada texto, a versão na língua quando existe; senão a inglesa, dentro do mesmo pacote. Quem está em pt não baixa o `lang-en`. | É o que a pessoa espera: "baixa só a minha língua, e o que não houver nela, em inglês". |
| "Ver original" | Fica para a **tradução automática** (o original está no aparelho). Some para texto **revisado ou derivado** gravado no pacote (títulos de eventos, nomes, descrições pt): o original inglês não é baixado. | Coerente com o pacote resolvido. Custo evitado: ~2,5 MB por língua. |
| Instalação no aparelho | Cada pacote é **juntado** ao banco local único (ATTACH → INSERT … SELECT → DETACH → apaga o arquivo). Remover = `DELETE … WHERE source_id`/`lang`. | As consultas do Repo não mudam. Manter cada pacote anexado esbarra no limite de ATTACH do SQLite (10 por padrão) com 30+ fontes. |
| Atualização | Versão e hash **por pacote** no manifesto; o app baixa só o que mudou. | Correção num comentário deixa de custar 500 MB. |
| Troca de língua | Pergunta "Baixar o conteúdo em <língua>?" com a lista e o tamanho do que falta. Até baixar, mostra o que já está no aparelho, com tradução automática quando houver modelo. Pacotes da língua anterior ficam até a pessoa remover. | Nada some nem fica vazio ao trocar. |
| Google Tradutor | Sai. No lugar, "Baixar tradução (~30 MB)" (liga a tradução e baixa o modelo). | O link levava o texto para fora do app; o modelo já existe e funciona offline. |
| Três vias de tradução | **Modelo** (prosa longa, todas as línguas), **derivado** no pipeline (nomes e glosas por alinhamento com a Bíblia de cada língua) e **revisado** (camada extra onde houver quem revise; hoje pt). | Só o modelo e o derivado escalam para 14 línguas e para as próximas. Nenhuma língua depende de revisão humana. |
| Origem do texto derivado | Nomes saem da Bíblia de cada língua (Strong do TAGNT/TAHOT × Bíblia livre da língua) e são revisados com auxílio de IA, com checagem automática contra o texto. Títulos são traduzidos com auxílio de IA e revisados por amostragem. Confiança baixa não entra; cai para o modelo. | O que vai para o aparelho é texto revisado ou derivado gravado no pacote; nada gerado por IA chega ao aparelho sem passar pela revisão e pela checagem. |

## 1. Vocabulário

- **Base**: o que não tem língua (grego, hebraico, números, ligações). Igual para todos.
- **Específico**: texto na língua do app (edição traduzida, nome ou glosa na língua).
- **Extra**: texto em inglês que entra porque não há versão na língua do app.
- **Obra**: um livro ou conjunto (ex.: *The Desire of Ages*). **Edição**: a obra numa língua, uma `source`.
- **Origem** de um texto curto traduzido: `revisado` (pessoa conferiu), `derivado` (pipeline, confiança alta),
  `original` (a língua da fonte).

## 2. Que via cada conteúdo usa

| Conteúdo | Volume hoje | Via | Observação |
|---|---|---|---|
| Comentários | 32 fontes, 314 MB | Edição + modelo | Gravar traduzido daria centenas de MB por língua. Edição traduzida só quando existir uma com licença livre. |
| Corpo dos verbetes de dicionário | 6 fontes, 35 MB | Edição + modelo | |
| Definições dos léxicos (TBESG, TBESH, LSJ) | 8 MB | Edição + modelo | |
| Glosas do léxico | ~14 mil Strong (5.497 NT, 8.525 AT) | **Derivado** (todas as línguas com Bíblia) + revisado (pt) + modelo no que faltar | Texto curto sem contexto é onde o modelo mais erra. |
| Nomes de pessoas e lugares | 9.950 entidades | **Derivado** da Bíblia de cada língua, revisado com auxílio de IA e checagem automática contra o texto (`nomes.py`, 12 línguas) | Revisão por amostragem por língua; o pt é o caso original (`nomes_pt.py`). |
| Títulos de tópicos e verbetes | 5.750 tópicos (Nave, Torrey); 13 mil títulos no total | Nomes próprios pelos nomes derivados; resto **traduzido com auxílio de IA e revisado por amostragem** (`titulos.py`, 12 línguas) | `"AFFLICTED, DUTY TOWARD THE"` → `"Duty toward the afflicted"` antes da tradução (§6). |
| Títulos de eventos | 450 | Revisado (pt) ou modelo, com os nomes já trocados | |
| Descrições de entidades | 8.370 | **Por regra** com gramática por língua, nas 12 línguas (`descricoes.py`; pt em `descricoes_pt`) | A prosa longa (Easton) ficou adiada: segue pelo modelo quando entrar. |
| Glosa contextual do token (`gloss_en`) | 67.817 valores | Não traduzir; na língua do app, mostrar a glosa do léxico | Muda com o contexto; não há como revisar. |
| Textos da interface | — | Tabelas `locales/` (já existe) | Fora deste contrato. |

Indonésio não tem Bíblia livre no catálogo: até ter, não há derivado; usa extra + modelo.

## 3. Pacotes

### 3.1 Base (`base-<versão>.zip` → `base.db`)

Obrigatório, ≈ 90 MB. Tabelas: `token` (físico: `token_t` + `dict_str`), `xref`, `entity` **sem texto** (id, tipo,
coordenadas, `data`), `entity_ref`, `lexicon_key` (chaves: `cite_id`, `key`, `strong_base`, `lemma`, `translit`,
`source_id`), `book`, `meta`, índices. Nenhuma coluna de texto em língua natural.

### 3.2 Língua (`lang-<xx>-<versão>.zip` → `lang-<xx>.db`)

Poucos MB. Uma tabela:

```sql
-- Texto curto de um registro, numa língua. Um pacote lang-xx tem, para cada (cite_id, field), uma linha só:
-- a de lang = 'xx' se existir; senão a de lang = 'en' (origin 'original').
CREATE TABLE l10n (
  cite_id    TEXT NOT NULL,          -- ent:…, lex:…, dic:…
  field      TEXT NOT NULL CHECK (field IN ('name','title','description','gloss','headword')),
  lang       TEXT NOT NULL,          -- língua do valor (pode ser 'en' num pacote de outra língua: é o extra)
  value      TEXT NOT NULL,
  origin     TEXT NOT NULL CHECK (origin IN ('original','revisado','derivado')),
  source_id  TEXT NOT NULL REFERENCES source(id),   -- sensus-nomes-<xx>, sensus-glosas-<xx>, theographic…
  PRIMARY KEY (cite_id, field)
);
```

- No banco completo (`data/sensus.db`, para o pipeline e para testes) a chave é `(cite_id, field, lang)` e há todas
  as línguas. O empacotamento resolve para uma língua.
- `entity_name` e `entity_text` viram vistas sobre `l10n` (`field = 'name'` / `'description'`), para não quebrar
  leituras durante a transição; `ptNames`/`ptNameIds` (`packages/core/src/repo/names.ts`) passam a ler `l10n`.
- `entity.name`/`entity.description` saem da base: o inglês vira linhas `l10n` com `origin = 'original'`.
- `meta` do pacote: `lang`, `version`, `schema_version`, contagens por `field` e `origin`.

### 3.3 Edição (`ed-<source_id>-<versão>.zip` → `ed-<source_id>.db`)

Uma por `source` de comentário, dicionário, índice ou léxico. Contém as linhas da fonte nas tabelas de sempre
(`commentary`, `dictionary_entry` + `entry_ref`, `lexicon_entry`) e a linha dela em `source`. O título original do
verbete (`dictionary_entry.headword`) e a glosa original (`lexicon_entry.gloss`) ficam na edição: são o "Ver original"
da tradução automática.

Mudança em `source`:

```sql
ALTER TABLE source ADD COLUMN work TEXT;   -- id da obra; edições da mesma obra têm o mesmo work. NULL = obra de uma edição só (work = id)
```

`cite_id` continua por edição (`com:{source}:{início}-{fim}`). Uma conversa antiga que citou a edição en abre a
edição instalada da mesma obra pelo `work` e pelo intervalo (§5).

### 3.4 Bíblias

Sem mudança ([idiomas-biblias-fontes.md §2](idiomas-biblias-fontes.md)). Continuam como arquivos separados,
abertos pelo `textDriver`.

## 4. Manifesto (`data-manifest.json`, `schema_version` 2)

```json
{
  "data_version": "2026.12.01",
  "schema_version": 2,
  "min_app_version": "1.7.0",
  "packs": [
    { "id": "base", "kind": "base", "lang": null, "work": null, "version": "2026.12.01",
      "url": "…/base-2026.12.01.zip", "sha256": "…", "md5": "…", "size": 0, "uncompressed_size": 0 },
    { "id": "lang-pt", "kind": "lang", "lang": "pt", "work": null, "version": "2026.12.01", "url": "…", … ,
      "counts": { "name": { "revisado": 0, "derivado": 0, "original": 0 }, "gloss": { … } } },
    { "id": "ed-sword-mhc", "kind": "edition", "lang": "en", "work": "matthew-henry", "source_kind": "commentary",
      "tradition": "reformed", "version": "2026.11.18", "url": "…", … }
  ],
  "full": { … }
}
```

- `version` por pacote: muda só quando o conteúdo do pacote muda. `data_version` é a do manifesto.
- `full` continua publicado enquanto houver apps abaixo de `min_app_version` do formato novo; apps novos ignoram.

## 5. Núcleo (`packages/core/src/domain/packs.ts`, puro e testado)

```ts
export type PackKind = 'base' | 'lang' | 'edition';
export interface PackEntry { id: string; kind: PackKind; lang: string | null; work: string | null; source_kind?: string;
  tradition?: string | null; version: string; url: string; sha256: string; md5?: string; size: number; uncompressed_size: number }
export interface PackCatalog { data_version: string; schema_version: number; min_app_version: string; packs: PackEntry[] }
export function parsePackCatalog(input: unknown): PackCatalog;

/** Edição de uma obra para a língua: a primeira da fallbackChain(lang) que existir. */
export function chooseEdition(editions: readonly PackEntry[], lang: AppLang): PackEntry | null;

/** Pacotes que a língua usa: base, lang-<lang> (ou lang-en se não houver) e uma edição por obra.
 *  Comentários fora da preferência (isCommentaryAllowed) não entram quando `respectPreference` é true. */
export function packsFor(catalog: PackCatalog, opts: { lang: AppLang; pref: CommentaryPreference; respectPreference: boolean }): PackEntry[];

/** O que falta baixar (id ausente ou versão instalada diferente). */
export function missingPacks(wanted: readonly PackEntry[], installed: ReadonlyMap<string, string>): PackEntry[];

/** Instalados que nenhuma língua escolhida usa mais (candidatos a remover em Configurações → Dados). */
export function unusedPacks(catalog: PackCatalog, installed: ReadonlyMap<string, string>, langs: readonly AppLang[], pref: CommentaryPreference): string[];

/** cite_id de comentário na edição instalada da mesma obra (citação antiga de outra edição). */
export function citeInInstalledEdition(citeId: string, works: ReadonlyMap<string, string>, installed: ReadonlySet<string>): string | null;
```

Testes: escolha de edição com e sem edição na língua; obra só em inglês; indonésio (sem lang-id → lang-en);
preferência que tira uma tradição; atualização de um pacote só; citação de edição removida.

### Texto curto exibido (`packages/core/src/domain/l10n.ts`)

```ts
export type ShownVia = 'pack' | 'machine' | 'original';
/** Ordem: valor do pacote na língua (revisado ou derivado) → tradução automática pronta → original. */
export function shownShortText(input: { packValue: { lang: string; value: string } | null; original: string;
  machine: string | null; appLang: AppLang }): { text: string; via: ShownVia; lang: string };
/** Título de tópico/verbete reescrito para o modelo: "AFFLICTED, DUTY TOWARD THE" → "Duty toward the afflicted". */
export function topicHeadwordForTranslation(headword: string): string;
```

`shownShortText` generaliza `preferPt` (`app/src/translate/policy.ts`). Testes com glosa grega (G0026) e hebraica
(H0430), e com título de tópico invertido e simples.

## 6. Tradução no app

- **Google Tradutor sai** de `SourcePanel.tsx`. Com a tradução desligada (e aparelho compatível): botão
  "Baixar tradução (~30 MB)", que chama `setEnabled(true)` e o download do modelo (`translate/store.ts`). Com falha:
  o "Tentar de novo" da `AutoTranslateNote`. No web: nada. Removem-se `googleTranslateLinks`
  (`packages/core/src/translate.ts`), os testes dele e `SRC.translate*`.
- O botão fica visível enquanto a tradução estiver desligada, mesmo depois de "Agora não" na oferta.
- **Textos curtos passam por `shownShortText`**, com um lote de tradução por lente (`useTranslatable`, policy
  `item`) para o que não veio do pacote:
  - Visão geral, passo da palavra — `Thread.tsx` (glosa) e passo de nomes — `thread.ts` (títulos de verbete);
  - Língua — `cards/word.tsx` (glosa; sai o "(en)" fixo, entra a marca discreta de origem);
  - Histórico — `cards/historico.tsx` (título do verbete);
  - Intertexto — `lenses/Intertexto.tsx` (títulos de tópicos, com `topicHeadwordForTranslation`);
  - Popover da palavra — `sources/SourcePopover.tsx`; citação no chat — `rich/RichBlocks.tsx`;
  - Painel da palavra — `sources/WordPanel.tsx` (linha do léxico que hoje não passa por `header.show`).
- Na língua do app, a glosa mostrada é a do léxico (`l10n` `gloss`), não a `token.gloss_en`.

## 7. Instalação, troca de língua e configurações (app)

- `app/src/data/packs/`: catálogo (busca + cache), download com sha256 (mesmo padrão de `download-engine.ts`),
  junção no banco local numa transação, tabela local `installed_pack (id, version, installed_at)`, remoção.
- Junção: `ATTACH` do pacote → `INSERT OR REPLACE … SELECT` por tabela → `DETACH` → apaga o arquivo. Atualizar uma
  edição = apagar as linhas do `source_id` e juntar a versão nova. Atualizar `lang-xx` = apagar `l10n` da língua e
  juntar.
- Apresentação (primeira vez): base + `lang-<lang>` + edições de `packsFor`, com o tamanho total antes.
- Troca de língua (`lang-store`): calcula `missingPacks(packsFor(novaLíngua))`; se houver, mostra a pergunta com a
  lista e o tamanho. "Agora não" não pergunta de novo nesta sessão; Configurações → Dados mostra o que falta.
- Configurações → Dados: pacotes agrupados por língua com tamanho, "Atualizar" quando há versão nova e "Remover" nos
  que `unusedPacks` aponta. A base e o pacote da língua atual não saem.
- Migração: quem já tem o `sensus.db` completo conta como tendo tudo instalado (versão = `data_version` antiga). Na
  primeira atualização, cada pacote novo substitui o seu pedaço; o app oferece remover as edições que a língua não usa.

## 8. Pipeline

- `build_db.py` continua gerando o banco completo (todas as línguas em `l10n`, todas as edições). Ele é a fonte dos
  pacotes e dos testes.
- `package_packs.py` (substitui `package_data.py`): gera `base`, um `lang-<xx>` resolvido para cada língua do app e
  um `ed-<source_id>` por fonte, e grava o manifesto v2. Pacote cujo conteúdo não mudou mantém a versão e a URL da
  release anterior (como o `--only` do `package_bibles.py`). Confere: toda `(cite_id, field)` da base tem linha em
  todo `lang-xx`; toda obra tem edição `en`.
- Derivado por alinhamento (`pipeline/sensus/align.py`, puro, e `pipeline/ingest/derivados.py`):
  - entrada: tokens com Strong (TAGNT, TAHOT) e a Bíblia da língua (staging de `pipeline/bibles`), versículo a
    versículo na numeração KJV;
  - lematização da língua alvo (e segmentação em zh e ja) antes de contar;
  - saída por língua: `corrections/glosas-<xx>.tsv` e `corrections/nomes-<xx>.tsv` com candidato, confiança e
    `origem` (`auto`, `revisado`, `sem`), preservando revisões entre execuções, como `nomes-pt.tsv`;
  - só `revisado` e `auto` com confiança alta viram linhas `l10n` (`origin = 'derivado'` ou `'revisado'`).
- O `nomes_pt.py` atual vira o caso pt desse fluxo.
- Fontes novas (edições traduzidas de obras): skill `nova-fonte`, com `work` preenchido no registro de fontes.

## 9. Riscos e medições antes de implementar

1. **Qualidade do alinhamento.** Rodar em pt e es e comparar com um conjunto conhecido (pt: glosas conferidas à mão;
   es: amostra). Se a confiança alta cobrir pouco, as glosas ficam com o modelo e o derivado vale só para nomes.
2. **Tempo da junção no aparelho.** Medir num Android médio a junção da maior edição (Gill, 47 MB) e da base. Se
   passar de alguns minutos, alternativa: juntar por lotes com progresso, ou manter as maiores edições anexadas.
3. **Licença dos derivados.** Uma lista de glosas tirada de uma Bíblia é obra derivada dela. Usar primeiro as de
   domínio público do catálogo; para as CC BY-SA, registrar a atribuição em `DATA_LICENSES.md`.
4. **Edições traduzidas.** Hoje nenhuma obra do banco tem edição em outra língua. Traduções modernas (Ellen White,
   Henry, Calvino em português) costumam ter direitos de editora; originais em domínio público em outras línguas
   (Lutero em alemão, Calvino em francês, Padres da Igreja) precisam de pesquisa por fonte.

## 10. Fases

1. Google Tradutor → "Baixar tradução"; textos curtos do estudo pela tradução automática (§6). Não depende do resto.
2. Teste do alinhamento em pt e es (§9.1) e medição da junção (§9.2).
3. Esquema: `l10n`, `source.work`, vistas de compatibilidade; `build_db.py` gerando `l10n` com o pt que já existe.
4. Manifesto v2, `package_packs.py`, instalação e atualização por pacote no app (conteúdo igual ao de hoje).
5. Pacotes de língua resolvidos, escolha de edição e pergunta na troca de língua.
6. Derivados para as línguas com Bíblia (glosas e nomes), depois títulos de tópicos.
7. Preferência de comentários decidindo o download (`respectPreference`).
8. Edições traduzidas de obras, uma a uma, pela skill `nova-fonte`.
