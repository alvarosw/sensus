# Backlog

Pendências registradas durante o desenvolvimento. Prioridade: **P1** (próximo), **P2** (secundário), **P3** (ideia).

## Dados

- **Feito — Tamanho do banco.** `token` e `verse_text` ficam em tabelas compactas
  (`pipeline/schema_physical.sql`): `cite_id` derivado (VIEW), `source_id` como inteiro, strings
  repetidas (strong, morfologia, glosas, edições) em `dict_str`. `resolveCite` busca `txt:`/`tok:`
  pela chave. O léxico passa a ter só os `strong_base` usados pelos livros escolhidos, como já dizia
  o docstring do builder (antes usava os tokens de toda a Bíblia). Filipenses: 75,6 MB → 33,9 MB
  (sem esse filtro, ~42 MB). Resta: `verse_text` (~11 MB, texto integral de 3 edições) e
  `dictionary_entry` (~5 MB), texto puro sem compressão possível em SQL. LSJ comprimido: não feito,
  porque o app não descomprime em SQL.
  Build com AT (hebraico) incluído: 163 MB → 70,9 MB. Ainda em aberto: distribuir o AT como download
  opcional, se o tamanho do app ainda importar.
- **P2 — Versificação.** `openbible-xref` usa as referências da fonte sem remapear para KJV;
  TAGNT tem 384 tokens com `pos` deslocado por colisão NRSV→KJV. Avaliar a tabela TVTMS do STEPBible.
- **Feito — `entity_ref` com `token_pos` NULL**: o builder remove duplicatas (a PK do SQLite não as
  detecta com NULL).
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
- **P3 — Descrições em inglês** (entidades, dicionários, léxico): tradução automática no aparelho (ML Kit, opcional,
  só Android) com o link do Google Tradutor como alternativa. Falta iOS e a qualidade da tradução por fragmentos.
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

- **P1 — Tela "Sobre e licenças" no app.** As atribuições precisam ser visíveis dentro do app, não só no
  repositório. Mostrar, para cada fonte usada, o campo `attribution` e a licença gravados na tabela
  `source`, com link para a URL de origem. Incluir os avisos de `DATA_LICENSES.md`: share-alike do
  Theographic (CC BY-SA 4.0), uso não comercial do RWP, GPL declarada do KJV e crédito "© OpenStreetMap
  contributors" se o ODbL se aplicar. Acesso a partir de Configurações, em pt-BR. Ao incluir uma fonte
  nova no build, atualizar a tela e `DATA_LICENSES.md` no mesmo commit.
- `theographic` é CC BY-SA 4.0: o banco distribuído herda o share-alike.
- `sword-rwp` (Robertson): distribuição livre apenas não comercial — aprovado porque o app é comunitário
  e não comercial. **Se o app algum dia for comercializado, remover esta fonte.** O "About" do módulo
  menciona expiração de copyright dos volumes 5–6 em 2006/2007; revisar.
- Créditos obrigatórios (CC BY): STEPBible/Tyndale House, OpenBible.info, Bíblia Livre.
