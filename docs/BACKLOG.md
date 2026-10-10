# Backlog

Pendências registradas durante o desenvolvimento. Prioridade: **P1** (próximo), **P2** (secundário), **P3** (ideia).

## Dados

- **P2 — Tamanho do banco.** Build de Filipenses com NT completo = 72 MB; com AT (hebraico) = 163 MB.
  Maiores tabelas: `token` (27 MB), `verse_text` (13 MB), `lexicon_entry` (10 MB). Ideias:
  trocar `cite_id` TEXT por chave composta derivável (o app reconstrói o cite_id), remover colunas
  redundantes (`strong_base` derivável de `strong`), distribuir o AT como download opcional,
  compactar verbetes longos (LSJ) ou carregá-los sob demanda.
- **P2 — Versificação.** `openbible-xref` usa as referências da fonte sem remapear para KJV;
  TAGNT tem 384 tokens com `pos` deslocado por colisão NRSV→KJV. Avaliar a tabela TVTMS do STEPBible.
- **P2 — `entity_ref` com `token_pos` NULL** não deduplica pela PK no SQLite (ingestores deduplicam
  em código). Considerar `token_pos INTEGER NOT NULL DEFAULT -1`.
- **P2 — Wesley (AT)** reaproveita notas entre versículos; linhas do AT precisam de revisão.
  Calvino: ~11 entradas truncadas no próprio módulo SWORD.
- **P2 — ISBE** contém artefatos de conversão ("ø" no lugar de "°", ">" soltos).
- **P2 — Smith**: poucos `entry_ref` resolvidos para Filipenses; revisar o parser de referências.
- **P1 — Smith: "Phil." mapeado para Filipenses** quando é Filemom (ex.: Ápia, Arquipo em "Phil. 2").
  Corrigir no `refparse.py` (desambiguar pelo número de capítulos: Filemom tem 1).
- **P2 — Patrística**: o Commentaries-Database só dedica a compilação ao domínio público; o ingestor
  mantém apenas citações verificadas literalmente em páginas ANF/NPNF (New Advent) — 12.429 de ~65 mil.
  Ampliar a verificação para o CCEL.
- **P2 — Gill** vem do módulo SWORD do SermonIndex (declarado domínio público na .conf, não verificado
  de forma independente).
- **P3 — Descrições em inglês** (entidades, dicionários): hoje traduzidas via link do Google Tradutor.
- **P3 — Macula Greek/Hebrew** (árvores sintáticas, CC BY 4.0) para diagramação do argumento.

## IA

- **P1 — Erros gramaticais da IA** (ex.: chamou φρονεῖτε de indicativo). Mitigação em andamento:
  variantes como pares de leituras com morfologia, regra de copiar `morph_desc`, e verificação
  determinística das afirmações morfológicas contra os tokens citados.
- **P1 — Alinhamento de variantes**: os pares de leituras são agrupados por posição na sequência
  amalgamada do TAGNT, o que pode parear palavras erradas (ex.: Fp 2:5 pareou "γὰρ" com "φρονεῖτε").
  Alinhar por lacunas entre palavras comuns às edições.
- **P2 — Citação de unidade literária** às vezes aponta para um versículo errado (ex.: unidade 2:1-30
  citada com o id de 1:30).
- Feito: relevância do contexto histórico (especificidade + correspondência com entidades/lemas).
- **P2 — Consistência**: dois usuários podem receber resumos diferentes para o mesmo trecho.
  Avaliar cache local (não persistido como conteúdo) ou temperatura 0.
- **P3 — Modelos com raciocínio** gastam tokens antes de responder; limites em `SUMMARY_MAX_TOKENS`.

## App

- **P1 — Rodar em dispositivo/emulador** (ainda não testado fora do `expo export`).
- **P2 — `importDatabaseFromAssetAsync`** é marcado como API de teste no expo-sqlite.
- **P3 — Vizinhos do tema** a partir do comportamento (palavra tocada → concordância; entidade → linha do tempo).

## Licenças

- `theographic` é CC BY-SA 4.0: o banco distribuído herda o share-alike.
- `sword-rwp` (Robertson): distribuição livre apenas não comercial — aprovado porque o app é comunitário
  e não comercial. **Se o app algum dia for comercializado, remover esta fonte.** O "About" do módulo
  menciona expiração de copyright dos volumes 5–6 em 2006/2007; revisar.
- Créditos obrigatórios (CC BY): STEPBible/Tyndale House, OpenBible.info, Bíblia Livre.
