# Publicação (release)

Como gerar e publicar o Sensus. Decisões do responsável:

- **Android:** build de release **local** com o EAS (`eas build --local`): não usa a cota de builds na nuvem.
  O keystore é **gerenciado pelo EAS** (remoto), criado no primeiro build e usado também pelo build local.
- **iOS:** build **na nuvem** do EAS, **só** quando o responsável roda `npm run release:ios`. Sem conta de
  desenvolvedor da Apple por enquanto, o iOS é **simulador**.
- **Release automática (Android):** enviar uma tag `v<versão>` dispara `.github/workflows/release.yml`, que faz o build
  com o **mesmo keystore** do build local, roda os testes e publica o APK no GitHub Releases. Veja a seção
  "Release automática" abaixo. O build local continua valendo como plano B.
- iOS e Bíblias **não** rodam sozinhos. Nenhum comando de iOS ou de Bíblias é chamado por CI.

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

## Release automática (GitHub Actions)

Gatilho: `git tag v<versão> && git push origin v<versão>`, depois que a versão está na `main`. O workflow:

1. Falha se a tag não bater com `APP_VERSION` em `app/app.config.ts`.
2. Roda `npm run check` (testes, typecheck e testes do pipeline).
3. Baixa o banco de leitura da release `reader-db` e roda `sync-db`.
4. `npm run release:android`: build `production` com `eas build --local` e `check-apk-secrets.sh`.
5. `npm run release:github -- --run`: cria a release `v<versão>` com o APK e o SHA-256 nas notas.

**Credenciais.** O keystore continua **só** no EAS (`credentialsSource: remote`). Não há keystore no repositório nem
nos secrets. O build local e o do GitHub baixam o mesmo keystore do mesmo projeto, então a assinatura é igual. O
workflow precisa de um único secret: `EXPO_TOKEN`. Ele dá acesso ao keystore, então trate como senha. O `GITHUB_TOKEN`
do próprio Actions publica a release.

**Setup único (faça uma vez):**

1. Token do Expo: em `expo.dev`, Account settings > Access tokens, crie um token da conta dona do projeto
   `@alvarosw/sensus`.
2. No GitHub: Settings > Environments > `release` > Add secret `EXPO_TOKEN`. Recomendado: em "Required reviewers",
   adicione você, para aprovar cada build antes de o keystore ser usado.
3. Banco de leitura: o APK leva `sensus-reader.db`, que não está no git (`data/*.db` é ignorado). Gere-o e publique
   como asset de uma release fixa:
   ```bash
   cd pipeline && python3 build_db.py --edition reader      # gera data/sensus-reader.db
   gh release create reader-db ../data/sensus-reader.db --title "Banco de leitura" --notes "Banco de leitura usado pelo build de release."
   ```
   Para atualizar depois: `gh release upload reader-db ../data/sensus-reader.db --clobber`. Não use o nome
   `data-<data>`: essas releases são o banco completo, que não serve ao APK.

**Status:** o workflow ainda não rodou no GitHub. O primeiro run é o teste real. Sem o secret `EXPO_TOKEN` ou sem a
release `reader-db`, o job para cedo com a mensagem de erro, antes de gastar tempo com o build.

**Plano B (local):** `npm run release:android` e `npm run release:github -- --run`, como antes. Exige `eas login` na
máquina.

## Bíblias (pacotes e catálogo)

Nenhuma Bíblia vem no APK: o app lê o catálogo `bibles-manifest.json` da `main` e baixa os pacotes da release
`bibles-<versão>` do GitHub. Ordem ao publicar Bíblias novas ou atualizadas:

1. `cd pipeline && python3 package_bibles.py --version <AAAA.MM.DD> [--only id1,id2]` (com `--only`, as outras
   entradas do manifesto continuam apontando para a release em que foram publicadas).
2. `gh release create bibles-<AAAA.MM.DD> dist/bibles/bible-*-<AAAA.MM.DD>.zip` (só os zips desta versão).
3. Commit do `bibles-manifest.json` na `main` e push: os apps instalados passam a ver as entradas novas.

Os pacotes precisam estar na release **antes** do manifesto chegar à `main`, e antes de publicar um app que dependa
deles (a 1.5.0 em diante exige baixar uma Bíblia na apresentação). Para testar um catálogo local no emulador:
`SENSUS_BIBLE_CATALOG_URL=http://localhost:<porta>/bibles-manifest.json` no build de teste (o `app.config.ts` grava
o endereço em `extra`; nunca no build publicado), com
`adb reverse tcp:<porta> tcp:<porta>`.

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
- **`npx` saindo com código 216, sem mensagem** (visto na 1.4.0): `app/node_modules` tinha virado um link para si
  mesmo (um link de worktree entrou num commit). Confira com `ls -ld app/node_modules`: tem de ser uma pasta. Se for
  link, `rm app/node_modules && npm install` na raiz. O `.gitignore` agora ignora `node_modules` também como link.
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
