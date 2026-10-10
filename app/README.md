# Sensus (app)

App mobile do Sensus (Expo SDK 57, expo-router, TypeScript). Interface em pt-BR.
Depende do workspace `@sensus/core` (`packages/core`).

## Comandos

Na raiz do monorepo, `npm install` instala tudo (workspaces). Depois, em `app/`:

```bash
npm run sync-db     # copia ../data/sensus.db para assets/sensus.db (gera bundled-db.json)
npm run typecheck   # tsc --noEmit
npx expo start      # servidor de desenvolvimento (Expo Go ou development build)
```

O banco do app é o `assets/sensus.db`. Enquanto o pipeline não gerar o banco real,
o placeholder (só com a tabela `book`) permite abrir o app.
Ao iniciar, o app copia o banco para o SQLite local apenas se o `meta.built_at`
mudou.

## Provedor de IA

O usuário cola a própria chave (BYOK) na tela de configurações. A chave fica no
expo-secure-store; URL e modelo ficam em `provider-settings.json`.

Em desenvolvimento, `app.config.ts` lê `../.env` (`NVIDIA_API_KEY`, `NVIDIA_BASE_URL`,
`NVIDIA_MODEL`) e expõe em `extra.devProvider`, usado só quando nada foi salvo.
Em builds de produção (`EAS_BUILD_PROFILE=production` ou `APP_ENV=production`) isso não ocorre.
