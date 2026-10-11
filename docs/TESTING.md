# Validação visual e testes

Ferramentas para ver o app sem celular. Todos os comandos partem de `app/`.

| Ferramenta | Para quê |
|---|---|
| `scripts/shot.mjs` | Captura PNG do app na web (Playwright/Chromium), com passos (toques, digitação, rolagem, esperas) |
| `scripts/emu.sh` | Emulador Android headless (AVD `rep-phone`) + Expo Go; capturas e gestos via adb |
| `src/ai/demo-provider.ts` | Provedor de IA offline que reproduz respostas reais gravadas (`dev/fixtures/`) |
| `scripts/record-fixtures.ts` | Grava as fixtures (usa a API real, uma vez) |

## Web com o banco real

`npx expo start --web --port <p>` renderiza o app com `assets/sensus.db` (42 MB) via expo-sqlite na web
(wa-sqlite + OPFS num Worker). Pontos de atenção:

- `metro.config.js` registra `wasm` como asset e acrescenta `Cross-Origin-Opener-Policy: same-origin` e
  `Cross-Origin-Embedder-Policy: credentialless` a todas as respostas do servidor (necessário para
  SharedArrayBuffer/OPFS). Sem isso o banco não abre.
- A primeira abertura copia o banco para o OPFS do navegador (~5 s). Os painéis também são mais lentos
  que no celular (montar um painel leva ~10 s na web): use esperas generosas.
- **Uma aba por vez** por origem (o OPFS é exclusivo): duas abas na mesma porta travam a segunda.
- `expo-file-system` e SecureStore não existem na web: `settings/provider-store.web.ts` usa `localStorage`.
  Código novo que precise de arquivos deve ter variante `.web.ts` ou tolerar a falha.
- Se mudar `metro.config.js` ou variáveis `EXPO_PUBLIC_*`, reinicie o servidor (`--clear` se necessário).

## Provedor de demonstração (offline)

- Preset `demo`, rótulo "Demonstração (offline)" (`src/settings/presets.ts`; telas devem usar
  `APP_PRESETS`/`APP_PRESET_IDS`/`buildAppProviderConfig` no lugar dos presets do núcleo).
- Fica ativo por padrão na web (nada salvo) e **sempre** com `EXPO_PUBLIC_SENSUS_DEMO=1` ao iniciar o Metro,
  mesmo que haja chave no `.env`. Não precisa de chave nem de rede.
- Reproduz o texto bruto gravado em ~40 caracteres a cada 30 ms (latência inicial de 250 ms), cancelável.
- Escolha da fixture: tipo do pedido (resumo / seção / pergunta) + intervalo (linha `# Passagem:` do contexto)
  + seção ou similaridade da pergunta; sem correspondência exata usa a mais próxima do mesmo tipo (os
  `cite_id` de outro intervalo aparecerão como citação inválida).
- Fixtures gravadas: Fp 2:5-8 e Fp 1:27-2:4 (resumo, seções `lingua` e `interpretacao`, 2 perguntas cada).
  Regravar: `npx tsx scripts/record-fixtures.ts --force` (precisa de `NVIDIA_*` no `.env` da raiz; leva vários
  minutos). Se o prompt do núcleo mudar muito, regrave.

## Capturas na web: `scripts/shot.mjs`

```bash
node scripts/shot.mjs --port 8091 --route "/" --out /tmp/home.png
node scripts/shot.mjs --port 8091 --route "/" --scheme dark --out /tmp/home-dark.png
node scripts/shot.mjs --port 8091 --route "/rota" \
  --steps '[{"waitText":"Visão geral","timeout":90000},{"waitStable":2500,"timeout":120000},{"tap":"verse-50002005"},{"wait":800}]' \
  --out /tmp/x.png
```

Imprime só os caminhos dos PNGs no stdout (o último é a captura final); logs vão ao stderr; sai com 1 em
falha (passo, timeout, bundle quebrado, tela de erro). Em falha de passo salva `<out>.error.png`.
Viewport 390x844 @2x, mobile/touch, `pt-BR`. Use `--help` para todas as opções.

- Servidor: se nada escuta na porta, inicia `npx expo start --web --port <p>` (log em
  `/tmp/sensus-web-<p>.log`) e o encerra no fim; `--keep-server` mantém, `--stop` encerra. **Cada agente deve
  usar sua própria porta** (ex.: 8091, 8092...). Não use a 8081 (terminal do usuário).
- Passos (JSON em `--steps` ou flags repetíveis, na ordem): `tap` (testID), `tapText` (texto, `exact`, `nth`),
  `type` (+`text`), `press`, `scroll` (testID ou `page`; `by` px ou `to: top|bottom`), `waitText`, `waitId`,
  `waitGoneText`, `waitGoneId`, `wait` (ms), `waitStable` (ms; fim de stream da IA), `shot` (captura
  intermediária, opcional `element`), `goto`. Todos aceitam `timeout`.
- `--profile <dir>` mantém OPFS/localStorage entre execuções (pula a cópia do banco); `--element <testID>`
  captura só um elemento; `--full-page`; `--demo 0|1` (ao iniciar o servidor).
- Falha com bundle quebrado imprime a mensagem do Metro. Se o Metro cachear um arquivo ausente que depois foi
  criado, reinicie o servidor (`--stop`).

## Emulador Android: `scripts/emu.sh`

```bash
EMU_OWNER=meu-agente scripts/emu.sh start        # ~1 min; headless, sem animações de janela
EXPO_PUBLIC_SENSUS_DEMO=1 npx expo start --port 8095 &   # Metro nativo em outra porta
scripts/emu.sh open 8095                          # instala Expo Go SDK 57 se faltar; abre exp://10.0.2.2:8095
scripts/emu.sh shot /tmp/emu.png                  # 1080x2400
scripts/emu.sh tap 540 1200 | swipe x1 y1 x2 y2 [ms] | text "abc" | back | home | key KEYCODE_X
scripts/emu.sh status | stop
```

- **Só um emulador por vez**: `start` cria `/tmp/sensus-emulator.lock` e falha na hora (código 3) dizendo
  quem o usa. Sempre rode `stop` ao terminar (libera o lock). Lock órfão é limpo sozinho.
- Na primeira abertura do Expo Go aparecem o aviso "System UI isn't responding" (toque em "Wait") e o menu de
  desenvolvedor (feche no X, ou `emu.sh back`). O primeiro bundle leva ~1 min. Um botão de engrenagem flutuante
  do Expo Go aparece nas capturas.
- Se o emulador não alcança o Metro (o app fica em "não foi possível conectar" ou o bundle não carrega), faça o
  túnel pelo adb e aponte o Metro para o loopback: `adb -s emulator-5554 reverse tcp:<porta> tcp:<porta>` e
  `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npx expo start --port <porta>` (ou `npx expo run:android -p <porta>`).
- `input text` só aceita ASCII. Pare o Metro que você iniciou (`kill` pelo PID).
- Um celular físico pode aparecer em `adb devices`; o script sempre usa `-s emulator-5554`.

## Build de release no celular

`expo prebuild` regrava os `scripts` de `app/package.json` (o Expo reescreve o arquivo a partir do template).
Por isso, depois de cada prebuild, rode `git checkout app/package.json` antes de commitar; caso contrário o
commit leva a reescrita junto. Fluxo completo:

```bash
cd app && npx expo prebuild --platform android
cd android && ANDROID_HOME=/home/albus/Android/Sdk APP_ENV=production NODE_ENV=production \
  ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
cd .. && git checkout app/package.json      # desfaz a reescrita do prebuild
adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk
```

Confira no APK que não há chave de API embutida (0 ocorrências de `nvapi-` nos recursos e no DEX).

## Convenção de `testID`

`kebab-case`, estável, com ids de dados no fim. Na web viram `data-testid`. Exemplos:

- `verse-<vid>` (ex.: `verse-50002005`), `lens-<key>` (`lens-lingua`), `cite-<cite_id>`, `sheet-detent-<name>`
- `screen-<nome>` (raiz de cada tela), `section-<key>`, `book-<abrev>`, `chapter-<n>`
- `input-<nome>`, `btn-<acao>` (ex.: `btn-send`), `question-<n>`, `status-<o-que>-<estado>`
  (ex.: `status-summary-done`, útil para esperar o fim de um stream em vez de `waitStable`).

Em listas, o id do dado vai no testID de cada item; evite testIDs repetidos para itens diferentes.
