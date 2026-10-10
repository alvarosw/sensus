const { getDefaultConfig } = require('expo/metro-config');

// Metro detecta automaticamente a raiz do monorepo (npm workspaces) e observa
// packages/core, então `@sensus/core` resolve direto do código-fonte TypeScript.
const config = getDefaultConfig(__dirname);

// O banco SQLite empacotado (assets/sensus.db) é importado como asset.
// `wasm`: o expo-sqlite na web (wa-sqlite) carrega o módulo WebAssembly como asset.
for (const ext of ['db', 'wasm']) {
  if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);
}

// Web: o expo-sqlite usa SharedArrayBuffer/OPFS num Web Worker, o que exige isolamento de origem
// (COOP/COEP) em TODAS as respostas do servidor de desenvolvimento, inclusive o HTML e o script do
// worker. `server.enhanceMiddleware` (receita da documentação) só cobre as respostas do Metro; o
// HTML é servido antes, pelos middlewares do Expo CLI. Como o Metro roda neste mesmo processo,
// acrescentamos os cabeçalhos em http.ServerResponse. `credentialless` mantém o isolamento sem
// exigir CORP de recursos de outras origens (ex.: fontes do Google).
const http = require('node:http');
const CROSS_ORIGIN_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};
const proto = http.ServerResponse.prototype;
if (!proto.__sensusIsolation) {
  const writeHead = proto.writeHead;
  proto.writeHead = function patchedWriteHead(...args) {
    if (!this.headersSent) {
      for (const [name, value] of Object.entries(CROSS_ORIGIN_HEADERS)) {
        if (!this.hasHeader(name)) this.setHeader(name, value);
      }
    }
    return writeHead.apply(this, args);
  };
  proto.__sensusIsolation = true;
}

module.exports = config;
