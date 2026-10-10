-- Layout físico do banco do app (contrato lógico: pipeline/schema.sql).
--
-- Aplicado por build_db.py depois da carga do staging, quando as tabelas lógicas `token` e
-- `verse_text` já estão preenchidas. As duas são compactadas e reexpostas como VIEWs com o mesmo
-- nome e as mesmas colunas, de modo que packages/core não muda sua SQL:
--   * cite_id deixa de ser armazenado: é derivado (tok:{corpus}:{vid}:{pos}, txt:{source}:{vid}).
--     Por isso repo.resolveCite consulta essas tabelas pela chave (vid/pos, source/vid), não por cite_id.
--   * source_id vira inteiro (src_code.sid); corpus vira 0 = gnt, 1 = hot.
--   * Strings repetidas (strong, morfologia, glosas, edições...) vão para dict_str e são referenciadas por id.
--     surface, variant_note e alt_ref continuam em texto, por serem quase todos distintos.
-- Tabelas pequenas (commentary, lexicon_entry, dictionary_entry, xref, entity...) mantêm o formato lógico.

-- Dicionário de strings repetidas. id estável dentro do arquivo; v é único.
CREATE TABLE dict_str (
  id  INTEGER PRIMARY KEY,
  v   TEXT NOT NULL UNIQUE
);

-- Código inteiro de cada fonte (ordem de source.id). Não usar rowid de source: VACUUM pode renumerá-lo.
CREATE TABLE src_code (
  sid        INTEGER PRIMARY KEY,
  source_id  TEXT NOT NULL UNIQUE REFERENCES source(id)
);
INSERT INTO src_code (source_id) SELECT id FROM source ORDER BY id;

INSERT OR IGNORE INTO dict_str (v)
  SELECT v FROM (
    SELECT translit AS v FROM token UNION SELECT lemma FROM token
    UNION SELECT strong FROM token UNION SELECT strong_base FROM token
    UNION SELECT morph FROM token UNION SELECT morph_desc FROM token
    UNION SELECT gloss_en FROM token UNION SELECT editions FROM token
  ) WHERE v IS NOT NULL;

-- Tokens. A chave (vid, pos, corpus) é a mesma da UNIQUE lógica; WITHOUT ROWID evita o índice duplicado.
CREATE TABLE token_t (
  vid            INTEGER NOT NULL,
  pos            INTEGER NOT NULL,
  corpus         INTEGER NOT NULL CHECK (corpus IN (0, 1)),
  sid            INTEGER NOT NULL REFERENCES src_code(sid),
  surface        TEXT NOT NULL,
  translit_id    INTEGER REFERENCES dict_str(id),
  lemma_id       INTEGER REFERENCES dict_str(id),
  strong_id      INTEGER REFERENCES dict_str(id),
  strong_base_id INTEGER REFERENCES dict_str(id),
  morph_id       INTEGER REFERENCES dict_str(id),
  morph_desc_id  INTEGER REFERENCES dict_str(id),
  gloss_id       INTEGER REFERENCES dict_str(id),
  editions_id    INTEGER REFERENCES dict_str(id),
  variant_note   TEXT,
  alt_ref        TEXT,
  PRIMARY KEY (vid, pos, corpus)
) WITHOUT ROWID;

INSERT INTO token_t (vid, pos, corpus, sid, surface, translit_id, lemma_id, strong_id, strong_base_id,
                     morph_id, morph_desc_id, gloss_id, editions_id, variant_note, alt_ref)
SELECT t.vid, t.pos,
       CASE t.corpus WHEN 'gnt' THEN 0 WHEN 'hot' THEN 1 END,
       c.sid, t.surface,
       (SELECT id FROM dict_str WHERE v = t.translit),
       (SELECT id FROM dict_str WHERE v = t.lemma),
       (SELECT id FROM dict_str WHERE v = t.strong),
       (SELECT id FROM dict_str WHERE v = t.strong_base),
       (SELECT id FROM dict_str WHERE v = t.morph),
       (SELECT id FROM dict_str WHERE v = t.morph_desc),
       (SELECT id FROM dict_str WHERE v = t.gloss_en),
       (SELECT id FROM dict_str WHERE v = t.editions),
       t.variant_note, t.alt_ref
FROM token t JOIN src_code c ON c.source_id = t.source_id;

-- Concordância (token WHERE strong_base = ?) e intervalos de versículo.
CREATE INDEX token_t_strong_base ON token_t (strong_base_id);

-- Textos: uma linha por (fonte, versículo).
CREATE TABLE verse_t (
  sid   INTEGER NOT NULL REFERENCES src_code(sid),
  vid   INTEGER NOT NULL,
  text  TEXT NOT NULL,
  PRIMARY KEY (sid, vid)
) WITHOUT ROWID;

INSERT INTO verse_t (sid, vid, text)
SELECT c.sid, v.vid, v.text FROM verse_text v JOIN src_code c ON c.source_id = v.source_id;

-- As tabelas lógicas cedem o lugar às VIEWs de mesmo nome.
DROP TABLE token;
DROP TABLE verse_text;

CREATE VIEW verse_text AS
SELECT 'txt:' || c.source_id || ':' || v.vid AS cite_id,
       c.source_id AS source_id,
       v.vid AS vid,
       v.text AS text
FROM verse_t v JOIN src_code c ON c.sid = v.sid;

CREATE VIEW token AS
SELECT 'tok:' || (CASE t.corpus WHEN 0 THEN 'gnt' ELSE 'hot' END) || ':' || t.vid || ':' || t.pos AS cite_id,
       c.source_id AS source_id,
       (CASE t.corpus WHEN 0 THEN 'gnt' ELSE 'hot' END) AS corpus,
       t.vid AS vid,
       t.pos AS pos,
       t.surface AS surface,
       tr.v AS translit,
       lm.v AS lemma,
       st.v AS strong,
       sb.v AS strong_base,
       mo.v AS morph,
       md.v AS morph_desc,
       gl.v AS gloss_en,
       ed.v AS editions,
       t.variant_note AS variant_note,
       t.alt_ref AS alt_ref
FROM token_t t
JOIN src_code c ON c.sid = t.sid
LEFT JOIN dict_str tr ON tr.id = t.translit_id
LEFT JOIN dict_str lm ON lm.id = t.lemma_id
LEFT JOIN dict_str st ON st.id = t.strong_id
LEFT JOIN dict_str sb ON sb.id = t.strong_base_id
LEFT JOIN dict_str mo ON mo.id = t.morph_id
LEFT JOIN dict_str md ON md.id = t.morph_desc_id
LEFT JOIN dict_str gl ON gl.id = t.gloss_id
LEFT JOIN dict_str ed ON ed.id = t.editions_id;
