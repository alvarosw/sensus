-- Sensus — esquema do banco de dados (SQLite).
-- Contrato entre o pipeline (ingestores → staging → builder) e o app.
--
-- Convenções:
--   vid  = id inteiro de versículo = livro*1_000_000 + capítulo*1000 + versículo
--          (livros 1..66 na ordem protestante; versificação canônica = KJV/inglesa).
--          Ex.: Filipenses 1:1 = 50001001.
--   cite_id = id textual estável e único de qualquer registro citável. A IA cita
--          exclusivamente por cite_id; o app resolve o cite_id para abrir a fonte.
--          Formatos (gerados por sensus.ids):
--            txt:{source}:{vid}            verse_text
--            tok:{corpus}:{vid}:{pos}      token
--            lex:{source}:{key}            lexicon_entry
--            com:{source}:{start}-{end}    commentary (sufixo .n se repetido)
--            dic:{source}:{slug}           dictionary_entry
--            xr:{source}:{from}:{start}-{end}  xref
--            ent:{source}:{id}             entity
--   strong = 'G' ou 'H' + 4 dígitos + sufixo opcional de desambiguação STEPBible
--          (ex.: 'G2424', 'H0430G'). strong_base = sem sufixo (ex.: 'H0430').
--   Todo texto é texto puro (UTF-8, parágrafos separados por "\n\n"), sem HTML.
--
-- Este arquivo descreve o contrato lógico. No banco do app, token e verse_text são VIEWs sobre
-- tabelas compactas (cite_id derivado, strings repetidas em dict_str): ver pipeline/schema_physical.sql.

CREATE TABLE source (
  id            TEXT PRIMARY KEY,      -- ex.: 'tagnt', 'blivre', 'sword-mhc'
  kind          TEXT NOT NULL CHECK (kind IN
                  ('text','tokens','lexicon','commentary','dictionary','topical','xref','entity')),
  title         TEXT NOT NULL,
  author        TEXT,
  lang          TEXT NOT NULL,         -- BCP-47: 'grc','hbo','pt','en'
  license       TEXT NOT NULL,         -- SPDX quando possível, ou 'Public Domain'
  license_url   TEXT,
  url           TEXT NOT NULL,         -- de onde foi obtido
  version       TEXT,                  -- commit, data ou versão do módulo
  retrieved_at  TEXT NOT NULL,         -- ISO-8601
  attribution   TEXT,                  -- texto de atribuição exigido pela licença
  tradition     TEXT,                  -- comentários: 'reformed','dispensational','patristic','methodist','baptist',...
  notes         TEXT
);

CREATE TABLE book (
  num        INTEGER PRIMARY KEY,
  osis       TEXT NOT NULL UNIQUE,
  name_pt    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  testament  TEXT NOT NULL CHECK (testament IN ('OT','NT')),
  chapters   INTEGER NOT NULL
);

-- Texto de traduções/edições, um registro por versículo.
CREATE TABLE verse_text (
  cite_id    TEXT PRIMARY KEY,
  source_id  TEXT NOT NULL REFERENCES source(id),
  vid        INTEGER NOT NULL,
  text       TEXT NOT NULL,
  UNIQUE (source_id, vid)
);

-- Divisões do texto (parágrafos e títulos de seção) que começam no versículo vid.
CREATE TABLE text_division (
  source_id  TEXT NOT NULL REFERENCES source(id),
  vid        INTEGER NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('paragraph','heading')),
  title      TEXT,
  PRIMARY KEY (source_id, vid, kind)
);

-- Palavras do texto original (corpus 'gnt' = NT grego, 'hot' = AT hebraico/aramaico).
-- pos = posição na sequência amalgamada da fonte (inclui palavras de todas as edições).
CREATE TABLE token (
  cite_id       TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES source(id),
  corpus        TEXT NOT NULL CHECK (corpus IN ('gnt','hot')),
  vid           INTEGER NOT NULL,
  pos           INTEGER NOT NULL,
  surface       TEXT NOT NULL,         -- forma como aparece (com acentos/pontos)
  translit      TEXT,
  lemma         TEXT,
  strong        TEXT,
  strong_base   TEXT,
  morph         TEXT,                  -- código morfológico (Robinson p/ grego, OSHB/ETCBC p/ hebraico)
  morph_desc    TEXT,                  -- descrição legível do código, se a fonte fornecer
  gloss_en      TEXT,
  editions      TEXT NOT NULL,         -- edições que contêm a palavra, separadas por vírgula: 'TR','BYZ','NA','SBL','WH','TH','LXX', 'L' (Leningrado)...
  variant_note  TEXT,
  alt_ref       TEXT,                  -- referência na versificação original, se diferente (ex.: hebraica)
  UNIQUE (corpus, vid, pos)
);

CREATE TABLE lexicon_entry (
  cite_id      TEXT PRIMARY KEY,
  source_id    TEXT NOT NULL REFERENCES source(id),
  key          TEXT NOT NULL,          -- strong (com sufixo, se houver) ou lema
  strong_base  TEXT,
  lemma        TEXT,
  translit     TEXT,
  gloss        TEXT,                   -- glosa curta
  definition   TEXT NOT NULL,          -- verbete completo em texto puro
  lang         TEXT NOT NULL,          -- idioma do verbete
  UNIQUE (source_id, key)
);

-- Comentários indexados por intervalo de versículos.
CREATE TABLE commentary (
  cite_id    TEXT PRIMARY KEY,
  source_id  TEXT NOT NULL REFERENCES source(id),
  start_vid  INTEGER NOT NULL,
  end_vid    INTEGER NOT NULL,
  text       TEXT NOT NULL
);

-- Dicionários, enciclopédias e índices tópicos (Easton, ISBE, Nave, Torrey...).
CREATE TABLE dictionary_entry (
  cite_id    TEXT PRIMARY KEY,
  source_id  TEXT NOT NULL REFERENCES source(id),
  headword   TEXT NOT NULL,
  text       TEXT NOT NULL
);

-- Versículos referenciados por um verbete (extraídos do próprio verbete).
CREATE TABLE entry_ref (
  entry_cite_id  TEXT NOT NULL REFERENCES dictionary_entry(cite_id),
  start_vid      INTEGER NOT NULL,
  end_vid        INTEGER NOT NULL,
  PRIMARY KEY (entry_cite_id, start_vid, end_vid)
);

CREATE TABLE xref (
  cite_id       TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES source(id),
  from_vid      INTEGER NOT NULL,
  to_start_vid  INTEGER NOT NULL,
  to_end_vid    INTEGER NOT NULL,
  weight        REAL                   -- relevância (ex.: votos do OpenBible); NULL se a fonte não tiver
);

-- Pessoas, lugares, eventos, grupos.
CREATE TABLE entity (
  cite_id      TEXT PRIMARY KEY,
  source_id    TEXT NOT NULL REFERENCES source(id),
  type         TEXT NOT NULL CHECK (type IN ('person','place','event','group','other')),
  name         TEXT NOT NULL,
  description  TEXT,
  lat          REAL,
  lon          REAL,
  data         TEXT                    -- JSON com campos extras da fonte
);

CREATE TABLE entity_ref (
  entity_cite_id  TEXT NOT NULL REFERENCES entity(cite_id),
  vid             INTEGER NOT NULL,
  token_pos       INTEGER,             -- posição do token, quando a fonte liga à palavra (NULL = sem ligação;
                                       -- o builder remove duplicatas, pois a PK não as detecta com NULL)
  PRIMARY KEY (entity_cite_id, vid, token_pos)
);

CREATE TABLE meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE INDEX idx_verse_text_vid   ON verse_text(vid);
CREATE INDEX idx_token_vid        ON token(vid);
CREATE INDEX idx_token_strong     ON token(strong_base);
CREATE INDEX idx_lex_strong       ON lexicon_entry(strong_base);
CREATE INDEX idx_com_range        ON commentary(start_vid, end_vid);
CREATE INDEX idx_entry_ref_range  ON entry_ref(start_vid, end_vid);
CREATE INDEX idx_xref_from        ON xref(from_vid);
CREATE INDEX idx_entity_ref_vid   ON entity_ref(vid);
