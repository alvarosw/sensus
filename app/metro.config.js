const { getDefaultConfig } = require('expo/metro-config');

// Metro detecta automaticamente a raiz do monorepo (npm workspaces) e observa
// packages/core, então `@sensus/core` resolve direto do código-fonte TypeScript.
const config = getDefaultConfig(__dirname);

// O banco SQLite empacotado (assets/sensus.db) é importado como asset.
config.resolver.assetExts = [...config.resolver.assetExts, 'db'];

module.exports = config;
