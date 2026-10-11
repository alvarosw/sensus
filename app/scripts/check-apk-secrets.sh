#!/usr/bin/env bash
# Falha (código 1) se o APK carrega segredos de desenvolvimento:
#   - "nvapi-" em qualquer lugar (chave de API da NVIDIA);
#   - a configuração injetada extra.devProvider / devProviderOptIn no JSON embutido (assets/app.config);
#   - a URL de teste dos dados de estudo (extra.dataManifestUrl, só com SENSUS_DEV_PROVIDER=1).
# O nome "devProvider" também aparece no bundle JS como identificador de código; isso é esperado e não conta.
#
#   app/scripts/check-apk-secrets.sh <arquivo.apk>
set -uo pipefail

apk="${1:-}"
if [[ -z "$apk" || ! -f "$apk" ]]; then
  echo "uso: check-apk-secrets.sh <arquivo.apk>" >&2
  exit 2
fi
command -v unzip >/dev/null || { echo "check-apk-secrets: unzip não encontrado" >&2; exit 2; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if ! unzip -q "$apk" -d "$tmp"; then
  echo "check-apk-secrets: não consegui abrir $apk" >&2
  exit 2
fi

status=0
check() {
  local label="$1" pattern="$2"
  local hits
  hits="$(grep -rlaE -- "$pattern" "$tmp" 2>/dev/null | sed "s#^$tmp/##")"
  if [[ -n "$hits" ]]; then
    echo "FALHA: $label ($pattern) em:" >&2
    sed 's/^/  /' <<<"$hits" >&2
    status=1
  fi
}

check "chave de API de desenvolvimento" 'nvapi-'
check "configuração de desenvolvimento embutida" '"devProvider"[[:space:]]*:[[:space:]]*\{'
check "opt-in de desenvolvimento embutido" '"devProviderOptIn"[[:space:]]*:'
check "URL de teste dos dados de estudo" '"dataManifestUrl"[[:space:]]*:'

if (( status == 0 )); then
  echo "OK: nenhum segredo de desenvolvimento em $(basename "$apk")"
fi
exit "$status"
