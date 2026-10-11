# Provedores de IA

O Sensus usa a IA para resumos e perguntas sobre o trecho. Há dois caminhos:

1. **Entrar com ChatGPT (principal).** Usa o plano do ChatGPT da pessoa (Go, Plus ou Pro) pelo recurso
   *Sign in with ChatGPT* da OpenAI, lançado no DevDay de 29/09/2026 (documentação em
   developers.openai.com/siwc).
2. **Chave de API (alternativa).** NVIDIA, OpenAI, OpenRouter ou endpoint compatível, com chave própria.

A escolha depende do **modo** em Configurações (padrão: Automático):

- **Automático**: usa o ChatGPT primeiro e a chave de API como reserva. Limite do plano, falha transitória ou
  parada do ChatGPT são resolvidos com a chave, sem aviso ao usuário. Conta com problema de acesso não usa a chave.
- **Só ChatGPT**: usa só o ChatGPT. Nunca usa a chave; limites e falhas aparecem como erro.
- **Só chave de API**: usa só a chave salva. O ChatGPT é ignorado.

Sem nenhum método disponível (sem ChatGPT pronto e sem chave), o app mostra a mensagem e um atalho para as
Configurações. O provedor de demonstração (offline) vale só quando definido. A chave do `.env` da raiz
(`NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_MODEL`) entra no build **só com opt-in explícito**:
`SENSUS_DEV_PROVIDER=1` (os scripts `start`, `android` e `ios` de `app/package.json` já definem a variável).
Sem o opt-in, nenhum build (dev ou release) embute a chave. Com o opt-in, `app.config.ts` grava
`extra.devProvider` e `extra.devProviderOptIn`, e o app só usa a chave quando `devProviderOptIn` está presente.
Builds de produção não devem definir a variável; `app/scripts/check-apk-secrets.sh <apk>` confirma isso no APK.

## Modelos no seletor (só chat)

O seletor de modelos da chave de API mostra só modelos que conversam em texto. Código: `packages/core/src/ai/models.ts`.

- **Metadados, quando o provedor os envia.** OpenRouter: `architecture.output_modalities` sem `text` oculta o
  modelo (imagem, áudio). Campo `type` (Together, LM Studio): embeddings, rerankers, imagem, moderação e código
  são ocultos.
- **Id, sempre.** Mesmo com saída de texto, o id vale: embeddings, rerankers, guardas de segurança, reward,
  parse/OCR, imagem, vídeo, áudio, tradução, código, completions legados e tempo real ficam ocultos.
  NVIDIA e OpenAI devolvem só ids, então dependem da heurística. Modelos de visão que conversam (ex.:
  `llama-3.2-11b-vision-instruct`) continuam visíveis.
- O modelo recomendado do preset aparece primeiro. "Mostrar todos" revela os ocultos.
- **Verificar modelo** (sob demanda, nunca em lote): um chat de 1 token com o modelo escolhido. ✓ = respondeu;
  ✗ = motivo do provedor (ex.: NVIDIA 404 "Function ... Not found for account").
- **Salvar verifica antes.** Salvar a conexão (chave, URL base, modelo) roda a mesma verificação. Se falhar
  (401, 404 "não disponível para esta conta", tempo esgotado em 30 s, rede), nada é salvo e o formulário mostra
  o motivo e sugestões. Sem resposta em 8 s, aparece o aviso "Demorando" com os modelos recomendados como opções
  rápidas; se responder depois, salva com "Funciona, mas está lento". Regras e estados em
  `app/src/settings/verify-save.ts` (função pura, testada em `verify-save.test.ts`). O núcleo só devolve ao fim
  da chamada, então o primeiro byte não é medido à parte.
- **Chave ou modelo?** Em 401/403/404 na verificação, a tela lista os modelos com a mesma chave (GET /models).
  Se a listagem funciona, a chave é aceita e a frase é "Este modelo não está disponível para esta chave ou
  conta" (o modelo não é da conta ou não existe); se a listagem recusa a chave, a frase é "Chave de API
  inválida". Sem resposta conclusiva, vale a frase do código HTTP.
- **Reaproveita sucesso recente:** um sucesso com a mesma chave, URL, modelo e corpo extra vale por 5 min; Salvar
  logo depois grava sem verificar de novo. Cancelar volta ao início; a resposta que chegar depois é ignorada. O resultado aparece logo acima de Salvar.
- **Modelos recomendados** (`RECOMMENDED_MODELS`, `packages/core/src/ai/recommended-models.ts`): grupo
  "Recomendados" acima da lista, com etiqueta (Equilibrado, Rápido, Preciso) e nota. Escolher um aplica também o
  `extraBody` do modelo (ex.: raciocínio desligado), salvo junto da conexão e substituindo o do preset.
- Teste de fixture: `packages/core/test/fixtures/nvidia-models.json` (80 ids reais, sem chave).

## Como funciona o login

Código: `packages/core/src/ai/siwc.ts` (funções puras, sem rede) e
`app/src/auth/chatgpt/` (rede, armazenamento e a janela de retorno).

1. O app sobe um servidor HTTP local em `127.0.0.1` (portas 1455 a 1459) **antes** de abrir o navegador.
   A aba é aberta com `openAuthSessionAsync` (redirect `sensus://settings`): o código continua vindo só pelo
   loopback, mas a biblioteca avisa quando a aba foi fechada (`cancel`).
2. Abre `https://auth.openai.com/api/accounts/authorize` com PKCE S256, `state` e `nonce` novos, o escopo
   `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct` e
   `resource=https://api.openai.com/v1`.
3. A OpenAI redireciona para `http://127.0.0.1:<porta>/auth/callback`. O app responde uma página curta
   ("Pronto! Volte ao Sensus") com um link `sensus://settings`, e fecha o servidor.
4. O app valida `state`. No primeiro registro, o callback devolve o **client_id emitido** (`oaiapp_...`),
   que é salvo com a conta. `dynamic_agent_client` nunca é usado para trocar código ou renovar.
5. Troca o código em `https://auth.openai.com/api/accounts/oauth/token` (form, sem segredo do cliente).
6. Valida o ID token: assinatura RS256 contra o JWKS da OpenAI (verificada em JavaScript puro com BigInt),
   `iss`, `aud` (client_id), `exp`, `iat`, `nonce`, `azp` e `sub`.
7. Confere se o escopo `chatgpt.tokens.use.direct` foi concedido. Sem ele, a conta fica salva com o plano
   desligado ("permissão não concedida").

Reautorização (incluindo "Liberar o plano") usa o mesmo client_id e não envia `agent_name_hint`. Só
`prompt=consent` é enviado, e apenas quando a pessoa pede.

**Cancelar.** Enquanto entra, a tela mostra "Cancelar" (`chatgpt-cancel`). Saem do login, com "Login
cancelado.": o botão; a aba fechada (`cancel`/`dismiss`); a volta ao app sem código, depois de uma folga de
1,5 s (`browserReturn.ts`, para o retorno do loopback que ainda estiver a caminho). Qualquer saída para o
loopback fechar o servidor e liberar o estado. Sair da tela também cancela.

## Renovação e saída

- O access token dura 1 hora. O app renova cerca de 60 s antes de expirar, e uma única vez após um 401.
- O refresh token **rotaciona**: access, refresh, expiração e escopos são trocados juntos. Renovações
  simultâneas são serializadas por conta.
- Refresh inutilizável (`invalid_grant`, `refresh_token_*` etc.) limpa os tokens e pede novo login, com o
  client_id salvo. Falha de rede ou 5xx **não** apaga nada.
- **Sair** revoga o refresh token em `oauth/revoke` (com nova tentativa em falha de rede) e apaga os
  tokens locais. O registro (client_id e identidade) fica, para o próximo login reutilizar. Se a revogação
  não for confirmada, o app avisa para desconectar em ChatGPT > Configurações.

## Elegibilidade e erros

O plano é usado somente por contas Go, Plus ou Pro. O uso é debitado do plano do ChatGPT, não de uma chave de API. Ele aparece na
própria conta do ChatGPT (Configurações > Uso). O plano Free não tem acesso.

Código: `packages/core/src/ai/openai-responses.ts` (mapeamento), `llm-error.ts` (`LLMError.resetAt` e
`chatGPTFailureOf`) e `reset.ts` (horário de volta).

| Situação | Código do núcleo | Classe (`chatGPTFailureOf`) |
|---|---|---|
| 429 `subscription_sharing_usage_limit_exceeded` (ou no meio do stream) | `plan_limit` (+ `resetAt?`) | `plan_limit` |
| 429 sem código de plano | `rate_limit` (+ `resetAt?`) | `rate_limit` |
| 403 `subscription_sharing_user_not_eligible` | `plan_not_eligible` | `not_eligible` |
| 401 `subscription_sharing_invalid_user` / 401 depois da renovação / refresh `invalid_grant` etc. | `reauth` | `reauth` |
| 403 `chatpass_v2_scope_not_authorized` / `chatpass_v2_invalid_authorization_context` (permissão do plano recusada) | `reauth` | `reauth` |
| 503 `subscription_sharing_usage_unavailable` / `subscription_sharing_user_unavailable` | `plan_unavailable` | `transient` |
| 5xx, falha de rede, parada sem bytes (45 s), stream sem `response.completed` | `server`, `network`, `timeout`, `protocol` | `transient` |
| 400 `subscription_sharing_unsupported_capability`, 403 `subscription_sharing_route_not_supported`, 403 genérico | `plan_unsupported` / `http` | `transient` |

Os documentos da OpenAI (developers.openai.com/siwc, errors-and-recovery e token-reference) **não informam
horário de volta** para o limite de uso: nenhum cabeçalho `Retry-After` ou `x-ratelimit-reset*`, nenhum campo
`resets_at`. Por isso o núcleo lê esses nomes **se** vierem (corpo: `resets_at`, `reset_at`, `retry_after`;
cabeçalhos: `Retry-After`, `x-ratelimit-reset*`, em segundos, duração `6m0s`, epoch ou data), aceita só valores
plausíveis (futuros e até 7 dias) e deixa `resetAt` vazio no resto. A documentação também manda não inferir
um horário a partir do código de limite.

### Política de escolha e reserva

Aplicada em `app/src/ai/client.ts` (`streamChat`, para resumo, Detalhar e chat) e `app/src/settings/route.ts`
(função pura, com testes em `route.test.ts`):

1. **Limite do plano** (`plan_limit`, `rate_limit`), no modo Automático: repete **o mesmo pedido** com a chave
   de API, sem mensagem ao usuário. Pausa o ChatGPT até o horário informado (`resetAt`, com "volta às HH:MM");
   sem horário, até **10 minutos** depois (`CHATGPT_LIMIT_RETRY_MS`, com "nova tentativa às HH:MM"). Durante a
   pausa, o modo Automático usa a chave. Não há chamadas de teste: a próxima pergunta real depois do horário
   tenta o ChatGPT de novo. Quando um pedido do ChatGPT dá certo, a pausa é apagada. A pausa vale também no
   Automático sem chave de API (o erro aparece e as perguntas não insistem no limite).
2. **Falha transitória** (5xx, rede, parada, protocolo): repete com a chave, sem pausa.
3. **Falha no meio da resposta**: se já chegou texto do ChatGPT, o texto parcial é descartado (`onRestart`)
   e a resposta é refeita inteira com a chave. Nunca há emenda de duas respostas.
4. **Falha de conta** (`reauth`, `not_eligible`): **não usa a chave**. Abre o modal "Sua conexão com o ChatGPT
   precisa de atenção" (`AttentionModal`, botões "Abrir Configurações" e "Agora não") e marca a conta como
   em atenção. Nas Configurações, o cartão mostra o motivo, com "Entrar de novo" e "Desconectar ChatGPT"
   (e "Tentar o plano de novo" para conta sem plano). O modo Automático continua sem usar a chave enquanto a
   conta estiver em atenção; ao desconectar, usa a chave normalmente. Um pedido que dá certo limpa a atenção.
   Não há bloqueio permanente sem chave: a atenção só muda o aviso e a rota de falha, não a elegibilidade.
5. **Só ChatGPT**: nunca usa a chave. Limite ou falha transitória aparece como erro (sem pausa).
6. **Só chave de API**: nunca chama o ChatGPT.
7. **Sem método disponível**: mensagem clara com atalho para as Configurações.

Os tempos e o modo ficam salvos no aparelho (`provider-prefs.json`, ou `localStorage` na web), sem chaves nem tokens.

Limites da prévia: `store=false` e `stream=true` são obrigatórios; mensagens de sistema vão em
`instructions`; `temperature`, `max_output_tokens` e `previous_response_id` não são enviados. O histórico
da conversa é reenviado a cada pergunta.

## Requisito: build de desenvolvimento

O login precisa de um servidor TCP local (`react-native-tcp-socket`). O módulo nativo não existe no
**Expo Go**. Nesse caso, o cartão mostra "Disponível no app instalado (build de desenvolvimento)" e o app
não quebra. Para testar:

```bash
cd app
npx expo run:android   # ou run:ios, localmente
# ou: eas build --profile development
```

A biblioteca não tem plugin de configuração. Ela está excluída da checagem de Directory do `expo-doctor`
(`app/package.json`, `expo.doctor`), porque o registro público ainda não marca suporte à Nova Arquitetura.
Confirmar em aparelho real antes de publicar.

## Privacidade

- Access token, refresh token e ID token ficam **só no aparelho**, no expo-secure-store (Keychain no iOS,
  Keystore no Android). Valores longos são divididos em partes de 600 caracteres, para caber nos limites
  do sistema.
- Nada vai para o banco do app, para arquivos, para logs nem para o repositório. Mensagens de erro não
  incluem o corpo das respostas do servidor.
- O `ext_agent_host_id` é um UUID criado uma vez por instalação e guardado no mesmo armazenamento.
- Tokens só trafegam para `auth.openai.com` e `api.openai.com`. Nunca vão em URLs.
- A conversa vai ao ChatGPT, como em qualquer provedor de IA. O Sensus não guarda o histórico da conversa
  em servidor próprio (não há servidor próprio).
- Na web não há login: o SecureStore não existe lá e o servidor TCP não é suportado.

### Tradução automática no aparelho (não é IA de provedor)

- Opcional e desligada por padrão (Configurações > Aparência e leitura). Traduz do inglês para o português
  os textos em inglês das fontes (léxico, entidades, dicionários, comentários), com o Google ML Kit Translation.
- A tradução roda **no aparelho**: o texto não sai do celular. O modelo (inglês e português, ~30 MB) é baixado
  uma vez, pelo Google Play Services, e fica disponível offline. Pode ser removido em Configurações.
- As traduções ficam **só na memória** durante a sessão: nada é gravado em banco, arquivo ou log. A única
  preferência gravada é se a tradução está ligada e se a oferta já foi respondida.
- Grego, referências bíblicas, números de Strong, URLs e abreviações não são traduzidos (ver
  `packages/core/src/translate-segments.ts`). A tradução pode conter erros: o texto original fica a um toque
  ("Ver original").
- Só no Android. No iOS e na web o recurso não aparece.

## Desconhecidos e limitações

- A documentação não publica os nomes exatos dos eventos de **raciocínio** do stream. O app aceita qualquer
  `response.reasoning*.delta` para mostrar "pensando".
- O corpo de erro de admissão (antes do stream) pode vir como `{"detail": ...}`. Esse texto é tratado como
  diagnóstico, não como código.
- `dismissAuthSession` é tentado, mas só tem efeito no iOS. No Android a aba se fecha sozinha ao chegar no
  redirect `sensus://settings`; se não fechar, a página diz que pode ser fechada.
- A aba do navegador no Android roda fora do app. O servidor local precisa continuar vivo nesse intervalo:
  testar em aparelho.
- Uso em apps públicos: a documentação diz que o lançamento inicial cobre projetos open source, uso pessoal
  local e alguns apps privados. Verificar os termos e a licença do DevKit antes de distribuir.
- Não há lista de modelos fixa: o modelo vem da lista da conta (`GET /v1/models`, só `visibility = list`).

## Testes

- `npx vitest run packages/core`: PKCE (vetor da RFC 7636), RS256 contra chaves geradas com `node:crypto`,
  callback, troca, renovação, erros de plano com fetch falso (`chatgpt-failures.test.ts`: `resetAt` por
  cabeçalho e corpo, classes de falha, parada, protocolo), o provedor e a API de erro.
- `npx vitest run app/src/settings`: a máquina de escolha e reserva (`route.test.ts`): modos, pausa de 10
  minutos (`CHATGPT_LIMIT_RETRY_MS`), horário informado, falhas por classe e a regra de atenção sem chave.
- `npx vitest run app/src/auth/chatgpt`: a máquina de retorno (cancelamento por folga, fechamento da aba,
  sucesso, settle, temporizadores).
- `cd app && npx tsc --noEmit` e `npx expo-doctor`.
- Teste real de login e de limite exige o navegador e a conta da pessoa; não é automatizado.
