#!/usr/bin/env bash
# Auxiliar do emulador Android (AVD "rep-phone") para testar o app no Expo Go, sem celular.
#
#   scripts/emu.sh start                 inicia o emulador sem janela e espera o boot
#   scripts/emu.sh open <porta>          instala o Expo Go (SDK 57) se faltar e abre exp://10.0.2.2:<porta>
#   scripts/emu.sh shot <arquivo.png>    captura a tela (adb exec-out screencap)
#   scripts/emu.sh tap <x> <y>           toque (a tela é 1080x2400)
#   scripts/emu.sh swipe <x1> <y1> <x2> <y2> [ms]
#   scripts/emu.sh text "texto"          digita (ASCII; espaço vira %s)
#   scripts/emu.sh back                  botão voltar        (também: home, key <KEYCODE>)
#   scripts/emu.sh status                mostra se está rodando e quem o iniciou
#   scripts/emu.sh stop                  encerra o emulador e libera o lock
#
# SÓ UM emulador por vez (4 núcleos / 11 GB): `start` cria um lock (/tmp/sensus-emulator.lock) e
# falha imediatamente, com código 3, se outro agente/terminal já o estiver usando. Identifique-se com
# EMU_OWNER="meu-agente" para a mensagem de lock ficar clara. `stop` sempre libera o lock.
#
# Variáveis: ANDROID_SDK_ROOT (padrão ~/Android/Sdk), EMU_AVD (padrão rep-phone), EMU_PORT (padrão 5554),
# EMU_BOOT_TIMEOUT (segundos; padrão 360), EMU_OWNER.
set -uo pipefail

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Android/Sdk}}"
ADB="$SDK/platform-tools/adb"
EMULATOR="$SDK/emulator/emulator"
AVD="${EMU_AVD:-rep-phone}"
PORT="${EMU_PORT:-5554}"
SERIAL="emulator-$PORT"
LOCK="${EMU_LOCK:-/tmp/sensus-emulator.lock}"
LOG="${EMU_LOG:-/tmp/sensus-emulator.log}"
BOOT_TIMEOUT="${EMU_BOOT_TIMEOUT:-360}"
OWNER="${EMU_OWNER:-${USER:-user}@$(hostname -s):pid$PPID}"
EXPO_GO_PKG="host.exp.exponent"
EXPO_SDK="57.0.0"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/sensus"

die() { echo "emu.sh: $1" >&2; exit "${2:-1}"; }
note() { echo "emu.sh: $*" >&2; }

adb_() { "$ADB" -s "$SERIAL" "$@"; }

need_tools() {
  [[ -x "$ADB" ]] || die "adb não encontrado em $ADB (defina ANDROID_SDK_ROOT)"
  [[ -x "$EMULATOR" ]] || die "emulator não encontrado em $EMULATOR (defina ANDROID_SDK_ROOT)"
}

lock_info() { [[ -f "$LOCK" ]] && cat "$LOCK" || true; }
lock_field() { lock_info | sed -n "s/^$1=//p" | head -1; }

lock_pid_alive() {
  local pid; pid="$(lock_field pid)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

running_emulators() { "$ADB" devices 2>/dev/null | awk '/^emulator-[0-9]+/ {print $1}'; }

is_booted() {
  [[ "$(adb_ shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]
}

require_running() {
  need_tools
  if ! running_emulators | grep -qx "$SERIAL"; then
    die "o emulador não está rodando. Inicie com: scripts/emu.sh start" 4
  fi
  is_booted || die "o emulador ainda está iniciando (boot não terminou). Aguarde ou rode 'scripts/emu.sh start'." 4
}

cmd_start() {
  need_tools
  # Lock órfão (emulador morreu sem `stop`): limpa.
  if [[ -f "$LOCK" ]] && ! lock_pid_alive; then
    note "removendo lock órfão ($(lock_field owner), pid $(lock_field pid))"
    rm -f "$LOCK"
  fi
  if [[ -f "$LOCK" ]]; then
    die "o emulador já está em uso por '$(lock_field owner)' desde $(lock_field since) (pid $(lock_field pid)). Só um emulador por vez: espere essa pessoa/agente rodar 'scripts/emu.sh stop'." 3
  fi
  local other; other="$(running_emulators | grep -vx "$SERIAL" | head -1 || true)"
  [[ -z "$other" ]] || die "há outro emulador Android rodando ($other) que não foi iniciado por este script. Encerre-o antes (só um por vez)." 3
  if running_emulators | grep -qx "$SERIAL"; then
    die "$SERIAL já está rodando sem lock (iniciado fora deste script). Encerre-o com 'adb -s $SERIAL emu kill'." 3
  fi
  "$EMULATOR" -list-avds | grep -qx "$AVD" || die "AVD '$AVD' não existe. AVDs: $("$EMULATOR" -list-avds | tr '\n' ' ')"

  # Aquisição atômica do lock (noclobber falha se o arquivo já existir).
  if ! ( set -o noclobber; : > "$LOCK" ) 2>/dev/null; then
    die "outro processo acabou de pegar o lock do emulador ($(lock_field owner)). Só um por vez." 3
  fi

  note "iniciando AVD '$AVD' em $SERIAL (sem janela, GPU swiftshader_indirect); log: $LOG"
  nohup setsid "$EMULATOR" -avd "$AVD" -port "$PORT" -no-window -no-audio -no-boot-anim \
    -gpu swiftshader_indirect -no-snapshot-save -no-metrics >"$LOG" 2>&1 &
  local epid=$!
  {
    echo "owner=$OWNER"
    echo "pid=$epid"
    echo "serial=$SERIAL"
    echo "avd=$AVD"
    echo "since=$(date '+%Y-%m-%d %H:%M:%S')"
  } >"$LOCK"

  local deadline=$((SECONDS + BOOT_TIMEOUT))
  until is_booted; do
    if ! kill -0 "$epid" 2>/dev/null; then
      note "o processo do emulador terminou. Fim do log:"
      tail -n 15 "$LOG" >&2
      rm -f "$LOCK"
      exit 1
    fi
    if (( SECONDS > deadline )); then
      note "boot não terminou em ${BOOT_TIMEOUT}s; encerrando."
      cmd_stop >/dev/null 2>&1
      exit 1
    fi
    sleep 3
  done
  # Estabiliza capturas: sem animações, tela acesa, desbloqueada.
  adb_ shell settings put global window_animation_scale 0 >/dev/null 2>&1
  adb_ shell settings put global transition_animation_scale 0 >/dev/null 2>&1
  # animator_duration_scale fica em 1: com 0 o Reanimated avisa "Reduced motion enabled" na tela.
  adb_ shell settings put global animator_duration_scale 1 >/dev/null 2>&1
  adb_ shell settings put system screen_off_timeout 2147483647 >/dev/null 2>&1
  adb_ shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
  adb_ shell wm dismiss-keyguard >/dev/null 2>&1
  note "pronto: $SERIAL (boot em ~$SECONDS s)"
}

cmd_stop() {
  need_tools
  local pid; pid="$(lock_field pid)"
  if running_emulators | grep -qx "$SERIAL"; then
    adb_ emu kill >/dev/null 2>&1 || true
  fi
  if [[ -n "$pid" ]]; then
    for _ in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
    if kill -0 "$pid" 2>/dev/null; then
      note "emulador não saiu; forçando (pid $pid)"
      kill -TERM "$pid" 2>/dev/null; sleep 2; kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$LOCK"
  note "emulador encerrado; lock liberado"
}

cmd_status() {
  need_tools
  if [[ -f "$LOCK" ]] && lock_pid_alive; then
    echo "em uso por '$(lock_field owner)' desde $(lock_field since) (pid $(lock_field pid), $(lock_field serial))"
    if is_booted 2>/dev/null; then echo "boot: concluído"; else echo "boot: em andamento"; fi
  else
    echo "livre"
  fi
}

expo_go_apk() {
  mkdir -p "$CACHE_DIR"
  local meta url ver apk
  meta="$(curl -fsS --max-time 30 https://api.expo.dev/v2/versions/latest)" || die "não consegui consultar api.expo.dev (sem rede?)"
  read -r url ver < <(printf '%s' "$meta" | python3 -c '
import json, sys
d = json.load(sys.stdin)["data"]["sdkVersions"]["'"$EXPO_SDK"'"]
print(d["androidClientUrl"], d["androidClientVersion"])') || die "SDK $EXPO_SDK não encontrado na API do Expo"
  apk="$CACHE_DIR/Expo-Go-$ver.apk"
  if [[ ! -s "$apk" ]]; then
    note "baixando Expo Go $ver"
    curl -fsSL --max-time 600 -o "$apk.part" "$url" || { rm -f "$apk.part"; die "falha ao baixar $url"; }
    mv "$apk.part" "$apk"
  fi
  echo "$apk"
}

installed_expo_go_version() {
  adb_ shell dumpsys package "$EXPO_GO_PKG" 2>/dev/null | tr -d '\r' | sed -n 's/^ *versionName=//p' | head -1
}

ensure_expo_go() {
  local have; have="$(installed_expo_go_version)"
  if [[ "$have" == 57.* ]]; then return 0; fi
  [[ -z "$have" ]] && note "Expo Go não está instalado" || note "Expo Go $have instalado; o app é SDK 57"
  local apk; apk="$(expo_go_apk)" || exit 1
  note "instalando $(basename "$apk")"
  adb_ install -r -g "$apk" >&2 || die "falha ao instalar o Expo Go"
}

cmd_open() {
  local port="${1:-}"
  [[ "$port" =~ ^[0-9]+$ ]] || die "uso: emu.sh open <porta do Metro>" 2
  require_running
  ensure_expo_go
  # Metro da máquina host, visto do emulador: 10.0.2.2
  if ! curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$port/status"; then
    note "aviso: nada respondeu em http://127.0.0.1:$port/status — o Metro está rodando nessa porta? (npx expo start --port $port)"
  fi
  adb_ shell am force-stop "$EXPO_GO_PKG" >/dev/null 2>&1
  adb_ shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:$port" "$EXPO_GO_PKG" >/dev/null \
    || die "falha ao abrir exp://10.0.2.2:$port"
  note "abrindo exp://10.0.2.2:$port no Expo Go (o primeiro bundle pode levar 1-2 min; confira com 'shot')"
}

cmd_shot() {
  local out="${1:-}"
  [[ -n "$out" ]] || die "uso: emu.sh shot <arquivo.png>" 2
  require_running
  mkdir -p "$(dirname "$out")"
  adb_ exec-out screencap -p >"$out" || die "falha no screencap"
  [[ -s "$out" ]] || die "captura vazia"
  echo "$out"
}

cmd_tap() { [[ $# -eq 2 ]] || die "uso: emu.sh tap <x> <y>" 2; require_running; adb_ shell input tap "$1" "$2"; }

cmd_swipe() {
  [[ $# -ge 4 ]] || die "uso: emu.sh swipe <x1> <y1> <x2> <y2> [ms]" 2
  require_running
  adb_ shell input swipe "$1" "$2" "$3" "$4" "${5:-300}"
}

cmd_text() {
  [[ $# -ge 1 ]] || die 'uso: emu.sh text "texto"' 2
  require_running
  local t="$*"
  if LC_ALL=C grep -q '[^ -~]' <<<"$t"; then note "aviso: 'input text' só aceita ASCII; outros caracteres serão ignorados/corrompidos"; fi
  t="${t//\'/\'\\\'\'}"   # escapa aspas simples para o shell do aparelho
  t="${t// /%s}"
  adb_ shell "input text '$t'"
}

cmd_key() { [[ $# -eq 1 ]] || die "uso: emu.sh key <KEYCODE>" 2; require_running; adb_ shell input keyevent "$1"; }

usage() { sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; }

main() {
  local sub="${1:-}"; shift || true
  case "$sub" in
    start) cmd_start "$@" ;;
    stop) cmd_stop "$@" ;;
    status) cmd_status "$@" ;;
    open) cmd_open "$@" ;;
    shot) cmd_shot "$@" ;;
    tap) cmd_tap "$@" ;;
    swipe) cmd_swipe "$@" ;;
    text) cmd_text "$@" ;;
    back) require_running; adb_ shell input keyevent KEYCODE_BACK ;;
    home) require_running; adb_ shell input keyevent KEYCODE_HOME ;;
    key) cmd_key "$@" ;;
    -h|--help|help|"") usage ;;
    *) usage >&2; die "subcomando desconhecido: $sub" 2 ;;
  esac
}

main "$@"
