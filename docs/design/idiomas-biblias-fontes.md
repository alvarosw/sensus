# Idiomas, repositório de Bíblias e preferência de fontes — contratos

Documento de trabalho (novembro de 2026). Define os contratos entre as frentes para que possam ser feitas em
paralelo sem conflito. Regras gerais continuam em [ARCHITECTURE.md](../ARCHITECTURE.md).

## 0. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| 14 idiomas | pt, en, zh, hi, es, ar, fr, bn, ru, id, ur, de, ja, vi | As 13 primeiras do Ethnologue 2025 por falantes totais; a 14ª da lista (pidgin nigeriano) não tem modelo de tradução no ML Kit nem na Apple, nem Bíblia livre; o árabe egípcio já é coberto pelo árabe. Vietnamita é a seguinte com tradução nos dois motores. |
| Chinês | Simplificado (`zh-Hans`) na interface; Bíblias em simplificado e tradicional | Maioria dos falantes; o catálogo pode ter as duas escritas. |
| Idioma inicial | Idioma do aparelho se estiver na lista; senão inglês. Quem já usa o app (preferências gravadas sem idioma) fica em português. | Não muda nada para os usuários atuais. |
| Fallback de texto | idioma escolhido → inglês → português | Para quem não lê português, inglês é melhor que pt. |
| Direita para esquerda (ar, ur) | Fase 1: texto com `writingDirection: 'rtl'` e alinhamento à direita; sem espelhar o layout | Espelhar (`I18nManager.forceRTL`) exige reiniciar o app e revisar geometria (alças, linha do tempo). Fica como próximo passo. |
| Traduções da interface | Preparadas com auxílio de IA, revisadas por amostragem; marcadas como "a revisar por falante nativo" | Mesmo critério das descrições pt. É código do app, não conteúdo gerado em tempo de uso. |
| Troca de idioma | Remonta a árvore a partir da raiz (`key={lang}`) | Os módulos de strings leem o idioma na hora do acesso; remontar basta, sem reiniciar o app. |
| Bíblias | Pacotes SQLite separados, baixados sob demanda; nenhuma vem no APK (BLivre e KJV também são pacotes desde o catálogo 2026.11.07) | O banco principal não cresce com cada Bíblia; cada pacote tem 2–6 MB. O APK fica ~9 MB menor, e a apresentação pede pelo menos uma Bíblia. |
| Filtro de fontes | Vale para comentários (papel `commentary`) em todo o app: lentes, painel da IA, citações | Um ponto só (Repo), para a IA nunca ver uma fonte que o leitor escondeu. |

## 1. Idiomas (`packages/core/src/domain/locale.ts`)

```ts
export type AppLang = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'ru' | 'zh' | 'hi' | 'ar' | 'bn' | 'ur' | 'id' | 'ja' | 'vi';
export interface AppLangInfo {
  code: AppLang;
  bcp47: string;          // 'pt-BR', 'en', 'zh-Hans', ...  (datas, IA, Intl)
  endonym: string;        // 'Português', 'English', '中文（简体）', 'हिन्दी', 'العربية', ...
  rtl: boolean;           // ar, ur
  mlkit: string | null;   // código do ML Kit (TranslateLanguage), ex.: 'pt', 'zh'
  apple: string | null;   // código do Translation da Apple, null se não houver
}
export const APP_LANGS: readonly AppLangInfo[];  // na ordem da tabela acima
export const DEFAULT_APP_LANG: AppLang = 'pt';
export function appLangInfo(code: AppLang): AppLangInfo;
export function isAppLang(x: unknown): x is AppLang;
/** Primeiro idioma do aparelho que está na lista (por `langBase`), senão 'en'. */
export function appLangFromDevice(tags: readonly string[]): AppLang;
/** Cadeia de fallback: [lang, 'en', 'pt'] sem repetição. */
export function fallbackChain(lang: AppLang): AppLang[];
```

Rótulos do núcleo que hoje são pt-BR (`testamentLabel`, `traditionLabel`, nomes de livros em `refs.ts`,
abreviações) passam a receber `lang: AppLang = 'pt'` como último parâmetro. O padrão `'pt'` mantém as chamadas
atuais funcionando. Os nomes de livros por idioma ficam em
`packages/core/src/domain/book-names.ts`, revisado à mão pelas convenções de cada idioma e conferido contra os
cabeçalhos `\toc1/\toc2/\toc3` das Bíblias do catálogo (`pipeline/bibles/book_names.py` extrai a referência):

```ts
export const BOOK_NAMES: Readonly<Partial<Record<AppLang, readonly { name: string; short: string; abbr: string }[]>>>;
// índice = número canônico do livro - 1 (66 livros, ordem protestante). Idioma sem tabela usa inglês.
```

### App (`app/src/i18n/`)

- `lang-store.ts`: store zustand com `lang: AppLang`, `setLang`, persistido nas preferências do app
  (`app-prefs.ts`, chave `appLang`). Ausência da chave com preferências já gravadas → `'pt'`; primeira execução →
  `appLangFromDevice(expo-localization)`.
- `t(key, vars)` passa a ler a tabela do idioma atual, com `fallbackChain`.
- `localized(tables)`: para os `strings.ts` das features e serviços. Uso:

  ```ts
  // app/src/features/study/strings.ts
  const pt = { sheet: 'Estudo do trecho selecionado', crosses: (a: string, b: string) => `atravessa ${a} → ${b}`, ... };
  export type StudyStrings = typeof pt;
  export const STUDY = localized<StudyStrings>({ pt, en, es, ... });
  ```

  Cada idioma fica em `app/src/i18n/locales/<lang>/<área>.ts` exportando um objeto tipado com o tipo do pt
  (`satisfies StudyStrings`; TypeScript cobra todas as chaves e as assinaturas das funções). `localized` devolve um
  Proxy que resolve a propriedade no idioma atual na hora do acesso, com fallback por chave. As chamadas
  (`STUDY.sheet`) não mudam.
- O pt continua no próprio `strings.ts` (fonte do tipo). Idioma sem arquivo ainda → fallback.
- `APP_LOCALE`/`APP_LANG` deixam de ser constantes: `currentBcp47()` e `currentLang()`.
- Raiz (`app/src/app/_layout.tsx`): `key={lang}` no conteúdo, para remontar ao trocar.
- Configurações → "Idioma": lista com o endônimo de cada idioma; ao escolher, troca na hora.

### Tradução automática

- O destino é o idioma do app (não mais "pt" fixo). A origem é a língua da fonte (`sourceLangOf`).
- `isTranslatableLang(lang)` vira `needsTranslation(sourceLang, appLang)`: verdadeiro quando as bases diferem e os
  dois idiomas têm modelo no motor (`mlkit`/`apple` não nulos).
- Módulo nativo `sensus-translate`: `status(from, to)`, `download(from, to)`, `translate(texts, from, to)`.
- Nomes e títulos pt (`ENTITY_NAME_LANG`, `ENTITY_TEXT_LANG`) só valem quando o app está em pt; em outro idioma a
  linha do tempo usa o original e a tradução automática.

## 2. Repositório de Bíblias

### Pacote (`bible-<id>-<version>.zip` → `bible-<id>.db`)

SQLite com o **mesmo esquema lógico** de `pipeline/schema.sql` para texto, para que as consultas de
`packages/core/src/repo/text.ts` rodem sem mudança:

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  -- bible_id, version, lang, schema_version ('1'), built_at, license, attribution
CREATE TABLE verse_text (source_id TEXT NOT NULL, vid INTEGER NOT NULL, text TEXT NOT NULL, PRIMARY KEY (source_id, vid));
CREATE TABLE text_division (source_id TEXT NOT NULL, vid INTEGER NOT NULL, kind TEXT NOT NULL, title TEXT, PRIMARY KEY (source_id, vid, kind));
CREATE TABLE book_name (book INTEGER PRIMARY KEY, name TEXT NOT NULL, short TEXT, abbr TEXT);
```

- `source_id` = id da Bíblia no catálogo (ex.: `rvr1909`, `lsg1910`, `cuv-hans`). `vid` = `book*1_000_000 +
  chapter*1000 + verse` (aritmética só por `pipeline/sensus` e `domain/vid`), versificação KJV.
- Só os livros do cânon protestante (66). Deuterocanônicos ficam de fora nesta fase.

### Catálogo (`bibles-manifest.json` na raiz do repositório)

```json
{
  "catalog_version": "2026.11.06",
  "schema_version": 1,
  "bibles": [
    {
      "id": "rvr1909", "abbr": "RVR1909", "name": "Reina-Valera 1909", "lang": "es",
      "license": "Public Domain", "license_url": null, "attribution": "…", "url": "https://ebible.org/…",
      "version": "2026.11.06", "testaments": ["OT", "NT"], "rank": 1,
      "package": { "url": "https://github.com/alvarosw/sensus/releases/download/bibles-2026.11.06/bible-rvr1909-2026.11.06.zip",
                   "sha256": "…", "size": 0, "uncompressed_size": 0 }
    },
    { "id": "blivre", "abbr": "BLivre", "name": "Bíblia Livre", "lang": "pt", "rank": 1, "package": { … }, … }
  ]
}
```

`rank` = ordem de recomendação dentro do idioma (1 = recomendada). `bundled: true` (catálogos até 2026.11.06) marcava
BLivre e KJV dentro do banco principal, sem `package`; o app ainda aceita o campo, mas trata a entrada só como não
baixável. BLivre e KJV saem do staging das fontes do banco principal (`data/staging/<id>/`), já na numeração da KJV.

### Núcleo (`packages/core/src/domain/bibles.ts`)

```ts
export interface BibleEntry { id; abbr; name; lang; license; license_url; attribution; url; version; testaments; rank; bundled?; package? }
export interface BibleCatalog { catalog_version: string; schema_version: number; bibles: BibleEntry[] }
export function parseBibleCatalog(input: unknown): BibleCatalog;          // valida; lança erro com mensagem
/** Bíblias do idioma do app primeiro (por rank), depois as demais agrupadas por idioma. */
export function recommendBibles(catalog: BibleCatalog, lang: AppLang): { recommended: BibleEntry[]; others: BibleEntry[] };
/** Lista completa por idioma: idioma do app, inglês, espanhol, demais pelo código. */
export function bibleLanguageGroups(catalog: BibleCatalog, appLang: string): BibleLangGroup[];
/** Lista curta: recomendadas do idioma do app e do inglês, depois as instaladas. */
export function suggestedBibles(catalog: BibleCatalog, appLang: string, installed: readonly string[]): BibleEntry[];
export function bibleAbbr(id: string, catalog: BibleCatalog | null): string;  // registro → catálogo → id
```

Repo: `new Repo(driver, { textDriver?: (sourceId) => SqlDriver | null })`. As funções de texto (`verseTexts`,
`chapter`, `neighbors`, divisões) usam `textDriver(sourceId) ?? driver`. O resto do Repo não muda.

### App

- `app/src/data/bibles/`: catálogo (busca + cache), instalação (download com sha256, mesmo padrão de
  `download-engine.ts`), remoção, lista de instaladas, abertura dos `bible-<id>.db` e o `textDriver` do Repo.
- Configurações → "Bíblias" e o passo de Bíblia da apresentação usam a mesma lista (`BiblePicker`): a curta
  (`suggestedBibles`) e, pelo botão "Ver todas as Bíblias", as demais por idioma (`bibleLanguageGroups`). Cada item
  baixa pelo ícone (progresso no anel, que para o download), vira lixeira quando baixado e, tocado, vira a principal
  (borda e rótulo "Principal"). A única baixada não sai (`canRemoveBible`).
- Seletor do leitor (`TopBar` / Aparência): lista as instaladas, não mais o alternador BLivre↔KJV.
- Preferência `textSource` (a principal) aceita qualquer id instalado; a primeira baixada vira a principal sozinha
  (app-prefs reage às instaladas); se a principal for removida, vai para a recomendada instalada do idioma, ou a
  primeira instalada. Referências cruzadas, concordância e o resumo literário leem o texto da principal.

## 3. Preferência de fontes de interpretação

### Núcleo (`packages/core/src/domain/source-prefs.ts`)

```ts
export interface CommentaryPreference {
  /** Tradições aceitas; null = todas. */
  traditions: string[] | null;
  /** Fontes escondidas individualmente (ids), mesmo com a tradição aceita. */
  hiddenSources: string[];
}
export const ALL_COMMENTARIES: CommentaryPreference = { traditions: null, hiddenSources: [] };
export function isCommentaryAllowed(sourceId: string, tradition: string | null, pref: CommentaryPreference): boolean;
export function parseCommentaryPreference(input: unknown): CommentaryPreference;  // tolerante: inválido → ALL
export function describePreference(pref, lang): string;  // "Todas", "Só adventista", "Adventista e reformada"…
```

Comentário sem tradição (null) só passa quando `traditions` é null.

Repo: `repo.setCommentaryPreference(pref)`; `commentaries(range)` e qualquer listagem de fontes de comentário
filtram por `isCommentaryAllowed`. Como o painel da IA monta o contexto a partir do Repo, a IA também só vê as fontes
aceitas.

### App

- `app-prefs.ts`: chave `commentaryPrefs`, aplicada ao Repo ao carregar e a cada mudança (e quando o banco ativo
  troca).
- Configurações → "Interpretação e comentários": escolha rápida ("Todas as tradições" / tradições marcadas) e, abaixo,
  as fontes de cada tradição com interruptor. Aviso quando o filtro deixa a lente vazia num trecho.
- O filtro temporário das lentes (`lens-model.ts`) continua; ele age dentro do que a preferência já aceitou.

## 4. Fontes de comentário: proteção contra regressão

As versões de dados 2026.10.18.1 e 2026.10.18.2 saíram sem 15 fontes (7 obras de Ellen G. White, Uriah Smith e 7
comentários do lote 1), porque o banco foi montado num checkout cuja `data/staging` não tinha essas pastas. Proteção:
`build_db.py --edition full` falha se faltar staging de alguma fonte do registro do núcleo (`SOURCES` em
`packages/core/src/domain/sources.ts`; `pipeline/sensus/registry.py`). `--allow-missing` existe só para bancos de
teste locais.
