# Sensus

App mobile de estudo bíblico aprofundado: ao selecionar um trecho, o leitor vê o processo
hermenêutico completo (texto, contexto literário, contexto histórico, língua original,
intertextualidade, história da interpretação) montado **apenas a partir de fontes determinísticas**,
e uma IA resume e responde perguntas citando cada afirmação pela fonte (`cite_id`), para que o
estudante possa auditar tudo. Nada gerado por IA é armazenado.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `pipeline/` | Ingestores Python (uma fonte cada) → `data/staging/` → `build_db.py` → `data/sensus.db` |
| `pipeline/schema.sql` | Contrato do banco (tabelas, `vid`, formatos de `cite_id`) |
| `packages/core/` | Núcleo TS sem dependências de plataforma: repositório, painel, IA, citações |
| `app/` | App Expo (React Native) |
| `docs/BACKLOG.md` | Pendências |

## Uso

```bash
# dados (cada ingestor baixa sua fonte para data/raw/)
cd pipeline && python3 -m venv .venv && .venv/bin/pip install requests lxml pysword
.venv/bin/python -I ingest/blivre.py   # ...e os demais ingestores
.venv/bin/python build_db.py --books Phil --sources <lista>

# núcleo e teste ponta a ponta (requer NVIDIA_API_KEY/NVIDIA_MODEL no .env)
npm install
npm test
npm run ask -- "Phil 2:5-8"

# app
cd app && npm run sync-db && npx expo start
```

Configuração: copie `.env.example` para `.env`. No app, cada usuário informa a própria chave
de API (qualquer provedor compatível com a API da OpenAI).

## Licenças dos dados

Cada fonte registra licença, URL, versão e atribuição na tabela `source`. Ver `docs/BACKLOG.md`
(seção Licenças) para as condições especiais.
