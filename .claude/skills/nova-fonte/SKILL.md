---
name: nova-fonte
description: Como acrescentar uma fonte de dados (comentário, léxico, dicionário, texto, entidades) ao banco do Sensus — licença, ingestor, registro de fontes e tradições, DATA_LICENSES.md e verificação. Use ao incluir qualquer fonte nova no pipeline.
---

# Fonte de dados nova

1. **Licença primeiro.** Só entra fonte cuja licença permite redistribuir o dado derivado. Leia o arquivo de licença
   da própria fonte (ex.: `DistributionLicense` no `.conf` de um módulo SWORD). Domínio público: confira a data e a
   regra do Brasil (vida do autor + 70 anos). Na dúvida, não inclua e relate.
2. **Ingestor** em `pipeline/ingest/<fonte>.py`, reaproveitando os genéricos (`sword_commentaries.py`,
   `sword_dicts.py`, `stepbible_common.py`, `refparse.py`). `source.json` com `license`, `license_url`, `url`,
   `version`, `attribution`, `lang` e, para comentários, `tradition`. `strong_base` sempre pela função única do
   pipeline.
3. **Registro de fontes** no núcleo (`packages/core/src/domain/sources.ts`): nome curto, comentarista (se for
   comentário) e tradição. Tradição nova → acrescente em `TRADITIONS` com o rótulo pt-BR. O teste do registro falha se
   faltar.
4. **`DATA_LICENSES.md`**: uma linha com fonte, licença, atribuição e o que foi derivado.
5. **Build e conferência**: `python3 pipeline/build_db.py --edition full` e confira contagens e 2–3 amostras
   (versículo → texto). Nunca commite `data/`, `*.db` nem textos brutos.
6. **Release de dados** é feita pelo responsável (`scripts/release-data.sh`); não rode sem pedido.
7. Siga `revisao-pre-merge` antes do merge.
