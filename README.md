# Sensus

Aplicativo móvel de estudo bíblico aprofundado. Ao selecionar um trecho, o leitor vê o processo
hermenêutico completo (texto, contexto literário, contexto histórico, língua original,
intertextualidade e história da interpretação), montado **apenas a partir de fontes determinísticas**.
Uma IA resume e responde perguntas citando cada afirmação pela fonte (`cite_id`), para que o
estudante possa auditar tudo.

> **Estado:** em desenvolvimento, ainda não publicado nas lojas. Projeto comunitário e sem fins comerciais.

## Princípios

- **Fontes primeiro.** Texto, léxico, comentários e dicionários vêm de fontes registradas, cada uma
  com licença e atribuição (ver [DATA_LICENSES.md](DATA_LICENSES.md)).
- **A IA resume e responde, com citação.** Toda afirmação gerada aponta para a fonte que a sustenta.
- **Nada gerado por IA é armazenado.**
- **Cada pessoa usa a própria conta.** O app não tem servidor próprio: o usuário informa a própria chave
  de API ou entra com a própria conta do ChatGPT.
- **Transparência de dados.** Licença, origem e atribuição de cada fonte são registradas e exibidas.

## Capturas

<!-- Placeholder: adicionar capturas de tela em docs/screenshots/ e referenciá-las aqui. -->

_Capturas em breve._

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `pipeline/` | Ingestores Python (uma fonte cada) → `data/staging/` → `build_db.py` → `data/sensus.db` |
| `pipeline/schema.sql` | Contrato do banco (tabelas, `vid`, formatos de `cite_id`) |
| `packages/core/` | Núcleo TypeScript sem dependências de plataforma: repositório, painel, IA, citações |
| `app/` | App Expo (React Native), interface em pt-BR |
| `docs/` | Pendências ([BACKLOG.md](docs/BACKLOG.md)), testes ([TESTING.md](docs/TESTING.md)), sistema de design ([DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)) |

## Como rodar

### Pré-requisitos

- Node.js (LTS recente) e npm, com workspaces.
- Python 3.13 para o pipeline de dados.
- Expo SDK 57 no app.
- Uma chave de API compatível com a API da OpenAI, apenas para o `npm test` ponta a ponta e o `npm run ask`.

### 1. Dados (pipeline)

Os dados brutos (`data/raw/`) e a staging (`data/staging/`) não vão para o repositório. Cada ingestor
baixa a própria fonte.

```bash
cd pipeline
python3 -m venv .venv && .venv/bin/pip install requests lxml pysword
.venv/bin/python -I ingest/blivre.py        # e os demais ingestores em pipeline/ingest/
.venv/bin/python build_db.py --books Phil --sources <lista>
```

### 2. Núcleo e testes

```bash
npm install            # na raiz: instala app e packages/* (workspaces)
npm test               # testes do núcleo (vitest)
npm run typecheck
npm run ask -- "Phil 2:5-8"   # requer .env configurado
```

Para configurar a chave de desenvolvimento, copie `.env.example` para `.env` e preencha os valores.
O `.env` nunca vai para o repositório.

### 3. App

```bash
cd app
npm run sync-db        # copia ../data/sensus.db para assets/sensus.db
npx expo start
```

- **Expo Go** serve para explorar a interface e o leitor.
- **Entrar com ChatGPT exige um development build** (não funciona no Expo Go). Gere um build de
  desenvolvimento com `npx expo run:android` ou `npx expo run:ios`, ou pelo EAS.
- Em desenvolvimento, `app/app.config.ts` lê o `.env` da raiz como provedor padrão. Builds de produção
  (`APP_ENV=production` ou `EAS_BUILD_PROFILE=production`) não leem esse arquivo.

## Testes e validação visual

Veja [docs/TESTING.md](docs/TESTING.md): captura de tela com Playwright, emulador Android,
provedor de IA offline com respostas gravadas (`dev/fixtures/`) e convenções de `testID`.

## Licenças

- **Código:** [GNU AGPL-3.0 ou posterior](LICENSE) (`AGPL-3.0-or-later`). Pipeline, núcleo e app.
  Pela cláusula de rede (seção 13), quem roda uma versão modificada como serviço acessível por rede
  deve oferecer o código-fonte modificado aos usuários desse serviço. Veja as escolhas em
  [docs/LICENSE_OPTIONS.md](docs/LICENSE_OPTIONS.md).
- **Dados:** a AGPL **não cobre os dados**. Cada fonte tem licença própria, listada em
  [DATA_LICENSES.md](DATA_LICENSES.md). O banco `sensus.db` inclui dados sob **CC BY-SA 4.0**
  (Theographic), além de fontes com atribuição obrigatória e uma fonte de uso não comercial.

## Contribuindo

Contribuições são bem-vindas.

1. Abra uma issue antes de mudanças grandes, para alinhar a abordagem.
2. Rode `npm test` e `npm run typecheck` antes de enviar.
3. Textos da interface em pt-BR. Documentação em português.
4. **Novas fontes de dados:** exigem `source.json` com `license`, `license_url`, `url`, `version` e
   `attribution`, e uma linha em [DATA_LICENSES.md](DATA_LICENSES.md). Só entram fontes cuja licença
   permita redistribuir o dado derivado.
5. **Nunca envie** chaves de API, o arquivo `.env`, `data/` ou o banco gerado (`*.db`).
