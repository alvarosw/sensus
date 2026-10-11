# Publicação (release)

Como gerar e publicar o Sensus. Decisões do responsável:

- **Android:** build de release **local** com o EAS (`eas build --local`): não usa a cota de builds na nuvem.
  O keystore é **gerenciado pelo EAS** (remoto), criado no primeiro build e usado também pelo build local.
- **iOS:** build **na nuvem** do EAS, **só** quando o responsável roda `npm run release:ios`. Sem conta de
  desenvolvedor da Apple por enquanto, o iOS é **simulador**.
- Nada disso roda sozinho: nenhum comando de release é chamado por CI ou por scripts de teste.

## Comandos do dia a dia (na raiz do repositório)

| Comando | O que faz |
|---|---|
| `npm run release:version -- 1.0.1` | Grava a versão em `app/app.config.ts` (`APP_VERSION`, fonte da verdade) e em `app/package.json`. |
| `npm run release:check` | Testes (vitest), typecheck do núcleo e do app e, se existir `dist/sensus-<versão>.apk`, a varredura de segredos. Aceita um APK: `npm run release:check -- dist/x.apk`. |
| `npm run release:android [-- preview\|emulator]` | Build local (APK) do perfil `production` (padrão), `preview` ou `emulator`; grava `dist/sensus-<versão>.apk` (ou `-preview.apk`, `-emulator.apk`), roda `app/scripts/check-apk-secrets.sh` e apaga o APK se houver segredo. Antes, o banco de leitura precisa estar sincronizado: `cd app && npm run sync-db ../data/sensus-reader.db`. |
| `npm run release:ios` | Build iOS `production` (simulador) na nuvem, com `--no-wait`; imprime o link do build. |
| `npm run release:github` | Imprime o `gh release create v<versão> dist/sensus-<versão>.apk ...` (com SHA-256 nas notas). Use `-- --run` para executar. |

Fluxo típico de uma versão Android:

```bash
git pull --rebase
npm run release:version -- 1.0.1
npm run release:check
npm run release:android
git add app/app.config.ts app/package.json && git commit -m "Versão 1.0.1"
npm run release:github          # confira e rode o comando impresso
```

Commite a versão **antes** do build: o build precisa estar no histórico.

## Configuração única

1. Ferramentas: Node LTS, JDK 17 e Android SDK com NDK (para o build local). Em `~/.bashrc`, `ANDROID_HOME`
   apontando para o SDK. O build local roda em Linux ou macOS (não Windows).
2. CLI do EAS: `npm i -g eas-cli`.
3. Conta Expo: `eas login` (ou `EXPO_TOKEN` para automação). Sem login, o build local não consegue baixar o keystore.
4. Projeto no EAS: já criado como `@alvarosw/sensus` (`eas init`); o `projectId` está em `app/app.config.ts`
   (`extra.eas.projectId`) e `owner: 'alvarosw'`. Para outra conta, rode `cd app && eas init --account <conta>`
   e troque os dois campos.
5. Keystore Android: já gerado pelo EAS no primeiro build local (não interativo). Para **baixar uma cópia**,
   que deve ficar fora do repositório (gerenciador de senhas ou cofre): `cd app && eas credentials -p android`
   (interativo; escolha exportar o keystore). **Nunca perca o keystore**: sem ele não há atualização sobre a
   mesma instalação, e a Play Store exige a mesma chave para sempre.
6. (Opcional) O SHA-256 do certificado aparece no mesmo `eas credentials -p android`; guarde-o.

Ao rodar `eas build` sem `--local`, o EAS consome a cota de builds da conta. Confira no painel
`expo.dev` (Billing). Builds locais não consomem a cota.

## Versões

- Nome da versão: `APP_VERSION` em `app/app.config.ts` (`npm run release:version`).
- Código (versionCode Android, buildNumber iOS): **remoto** (`cli.appVersionSource: "remote"` em `app/eas.json`).
  O perfil `production` tem `autoIncrement` (`versionCode` no Android, `buildNumber` no iOS), e o EAS incrementa
  a cada build. Os valores de `app.config` para código são ignorados nesse modo.
- Confirmado no primeiro build local (perfil `preview`): o `--local` aceita a versão remota e o EAS incrementa o
  versionCode no servidor a cada build (2, 3, ...). Não é preciso commitar nada para o código de versão.

## Como o build local monta o APK

- O EAS monta o arquivo do build a partir dos `.gitignore`, o que deixaria de fora o banco de leitura
  (`app/assets/sensus.db`, gitignored e necessário ao bundle). Por isso `release:android` cria um `.easignore`
  temporário na raiz, com exatamente os caminhos que o git ignora, menos esse banco, e o remove ao fim do build.
  Se um build for interrompido à força, apague `.easignore` da raiz antes de tentar de novo (não é versionado).
- Antes do build, o banco de leitura deve estar no `app/assets/` (`npm run sync-db ../data/sensus-reader.db`).
  Sem ele o bundle falha com "Unable to resolve module ../../assets/sensus.db".
- O `ANDROID_HOME` padrão é `~/Android/Sdk`, se existir.
- O build trabalha em `TMPDIR`. O `/tmp` costuma ser um tmpfs pequeno (5,8 GB aqui) e o NDK estoura ("No space left
  on device"), então o script usa `~/.cache/sensus-release-tmp` se `TMPDIR` não estiver definido. Um build completo
  leva cerca de 30 minutos (Gradle, NDK e R8).
- **Arquitetura (ABI):** os perfis `production` e `preview` definem, em `app/eas.json`, a variável
  `ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a`. O Gradle a lê como `-PreactNativeArchitectures`
  (`app/android/gradle.properties`, que lista as quatro ABIs), então o APK de distribuição leva só `arm64-v8a`.
  Antes disso o APK empacotava as quatro (~95 MB). Todo celular Android atual é arm64.
- **Emulador (QA):** o perfil `emulator` (estende `preview`) troca a variável por `x86_64`, para rodar no AVD
  `rep-phone`. O APK gerado (`dist/sensus-<versão>-emulator.apk`) não é para distribuição: não suba para o GitHub.
  Conferência: `unzip -l <apk> | awk '$4 ~ /^lib\//{split($4,a,"/"); print a[2]}' | sort -u` lista só as ABIs do APK.
- **Tamanho:** o APK `preview` 1.0.0 com só arm64-v8a mede 38,8 MB (era 94,6 MB com quatro ABIs). Ele inclui o
  banco de leitura (`res/Qu.db`, 17 MB). Meta de envio direto: ≲ 55 MB.
- Verificação feita no primeiro build: `check-apk-secrets.sh` passou; o banco de leitura entrou como `res/Qu.db`.

## Perfis do `app/eas.json`

- `development`: dev client, simulador iOS (`ios.simulator: true`), `APP_ENV=development`.
- `preview`: estende `production`, distribuição interna (APK Android arm64-v8a; simulador iOS).
- `emulator`: estende `preview` e troca a ABI para `x86_64` (QA no emulador Android). Só para teste local.
- `production`: APK para instalação direta (Android, `buildType: apk`, arm64-v8a); iOS simulador por enquanto.
  `APP_ENV=production` sempre. Nunca defina `SENSUS_DEV_PROVIDER` em um perfil: ele injeta a chave de
  desenvolvimento no app (ver `docs/AI_PROVIDERS.md`).

Para gerar um AAB (Play Store) depois: `android.buildType: "app-bundle"` em um perfil novo, e `eas submit`.

## Quando houver conta de desenvolvedor da Apple

Passos (ainda não usados; `eas.json` é JSON estrito, então a variante fica aqui):

1. Registrar aparelhos (UDID) para build de teste: `eas device:create`.
2. Build para aparelho (ad hoc, distribuição interna): no perfil `preview`, `"ios": { "simulator": false }`, e
   `eas build -p ios --profile preview`. Instale pelo link que o EAS gera (a conta precisa de Apple Developer Program).
3. TestFlight: no perfil `production`, `"ios": { "simulator": false, "autoIncrement": "buildNumber" }`; depois
   `eas build -p ios --profile production` e `eas submit -p ios --latest`. Antes, adicione em `app/eas.json` um
   bloco `submit.production.ios` com `ascAppId` e `appleTeamId`, e crie o app na App Store Connect com o mesmo
   bundle id.
4. O bundle id (`com.sensus.app`) é permanente depois de registrado na Apple. Confirme antes.

## Checklist do primeiro build iOS (simulador)

Não há como compilar iOS no Linux. Itens que precisam ser confirmados no primeiro `npm run release:ios` e no
simulador (`eas build:run -p ios --latest`):

- **Tradução (ML Kit):** o pod `GoogleMLKit/Translate` 8.0.0 instala e linka (framework estático). Baixar os modelos e
  traduzir no simulador. Se o simulador não tiver a fatia arm64 do ML Kit, a tradução aparece como indisponível (é o
  comportamento esperado de fallback). Em caso de erro de link, ajuste o linkage em `expo-build-properties`
  (`ios.useFrameworks`).
- **Login ChatGPT (loopback):** `react-native-tcp-socket` precisa aparecer em `NativeModules.TcpSockets` com a
  New Architecture (`isChatGPTNativeAvailable()` true). `NSAllowsLocalNetworking` está em `ios.infoPlist` para
  `http://127.0.0.1`. Confirme que o retorno para o app fecha a sessão do navegador (`expo-web-browser`).
- **Mapa (MapLibre):** o mapa renderiza, o estilo carrega e o toque nos marcadores funciona.
- **Banco e download:** `expo-sqlite` abre o banco de asset; o download da edição completa, o `react-native-zip-archive`
  e a verificação sha256 terminam; o arquivo fica em Application Support, e não some ao reiniciar.
- **Teclado:** `react-native-keyboard-controller` sobe o campo do chat; o teclado não cobre a caixa de texto.
- **Keychain:** `expo-secure-store` salva a chave do provedor e o token do ChatGPT; limpar o app não vaza nada.
- **Voltar (gesto de borda):** o gesto de voltar do iOS navega sem travar a folha do estudo.
- **Versões:** `CFBundleShortVersionString` = `APP_VERSION`; o build number vem do EAS.

## Build Android local: validação sem o EAS

Para checar que o projeto gera um release sem passar pelo EAS (sem consumir nada), use o fluxo descrito em
`docs/TESTING.md` (prebuild, `assembleRelease`, `check-apk-secrets.sh`). O prebuild reescreve os `scripts` de
`app/package.json`: o `release:android` restaura o arquivo sozinho; no fluxo manual, salve uma cópia antes e
restaure depois (não use `git checkout` se houver mudanças não commitadas).
