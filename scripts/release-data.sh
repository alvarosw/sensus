#!/usr/bin/env bash
# Publica o banco completo como release de dados no GitHub (tag data-<data_version>).
#
# Uso, a partir da raiz do repositório:
#   scripts/release-data.sh            gera o ZIP e o manifesto e cria a release com gh
#   scripts/release-data.sh --dry-run  só gera o ZIP e o manifesto e mostra o comando (não chama gh)
#
# Antes: data/sensus.db gerado (cd pipeline && python3 build_db.py --edition full --data-version AAAA.MM.DD).
# Depois: commitar data-manifest.json em main. O app lê o manifesto de
#   https://raw.githubusercontent.com/alvarosw/sensus/main/data-manifest.json
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; fi

# MIN_APP_VERSION (opcional): versão mínima do app no manifesto; padrão = a do app/package.json.
python3 "$ROOT/pipeline/package_data.py" ${MIN_APP_VERSION:+--min-app-version "$MIN_APP_VERSION"}
SOURCES=$(python3 -c 'import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute("select count(*) from source").fetchone()[0])' "$ROOT/data/sensus.db")

read -r VERSION SHA256 SIZE UNCOMPRESSED < <(python3 -c '
import json, sys
m = json.load(open(sys.argv[1]))
f = m["full"]
print(m["data_version"], f["sha256"], f["size"], f["uncompressed_size"])
' "$ROOT/data-manifest.json")
ZIP="$ROOT/dist/data/sensus-full-$VERSION.zip"
TAG="data-$VERSION"

NOTES="$(cat <<EOF
Banco completo do Sensus, dados versão $VERSION (66 livros, $SOURCES fontes).

Arquivo: sensus-full-$VERSION.zip (ZIP com uma entrada, sensus.db). O app baixa e confere o SHA-256 antes de usar.
- SHA-256 do ZIP: $SHA256
- Tamanho do ZIP: $SIZE bytes; banco descompactado: $UNCOMPRESSED bytes.

Licença dos dados: este banco é uma compilação de fontes com licenças próprias. Cada fonte mantém os seus termos.
A AGPL do código não se aplica aos dados.

Atribuições (resumo; a lista completa está em DATA_LICENSES.md e no campo attribution da tabela source):
- CC BY-SA 4.0 (share-alike): Theographic Bible Metadata, por Robert Rouse / viz.bible. No que deriva desses
  dados, o banco está sob CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Quem redistribuir deve
  manter esta atribuição e a licença.
- CC BY 4.0: STEP Bible (www.STEPBible.org), baseado em trabalho da Tyndale House Cambridge (TAGNT, TAHOT, hebraico
  do AT, TBESG, TBESH, TFLSJ, TIPNR); OpenBible.info (geocodificação e referências cruzadas).
- CC BY 3.0 Brasil: Bíblia Livre (BLIVRE), Diego Santos, Mario Sérgio e Marco Teles.
- Uso NÃO COMERCIAL: Robertson's Word Pictures (A. T. Robertson), módulo SWORD RWP v2.0 (CrossWire Bible Society).
  Estas linhas só podem ser usadas sem fins comerciais.
- Domínio público, com a origem indicada: KJV (módulo SWORD; o módulo declara GPL), comentários e dicionários
  SWORD (Barnes, Clarke, Calvin, Jamieson-Fausset-Brown, Keil-Delitzsch, Matthew Henry, Scofield, Wesley, Easton,
  Hitchcock, ISBE, Smith, Nave, Torrey, Treasury of Scripture Knowledge), Gill (SermonIndex) e trechos de
  Pais da Igreja verificados em edições de domínio público.
- ODbL 1.0: podem existir coordenadas derivadas do OpenStreetMap (© OpenStreetMap contributors).

Este texto resume as licenças e não é parecer jurídico.
EOF
)"

if (( DRY_RUN )); then
  echo "Comando que seria executado:"
  echo "  gh release create $TAG $ZIP --title \"Dados Sensus $VERSION (banco completo)\" --latest=false --notes <notas: $(printf '%s' "$NOTES" | wc -l) linhas>"
  exit 0
fi

command -v gh >/dev/null || { echo "gh não encontrado (https://cli.github.com)." >&2; exit 1; }
gh release create "$TAG" "$ZIP" \
  --title "Dados Sensus $VERSION (banco completo)" \
  --latest=false \
  --notes "$NOTES"
echo "Release $TAG criada. Commite data-manifest.json em main para o app encontrar os dados."
