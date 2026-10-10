# Provedores de IA

O Sensus usa a IA para resumos e perguntas sobre o trecho. Há dois caminhos:

1. **Entrar com ChatGPT (principal).** Usa o plano do ChatGPT da pessoa (Go, Plus ou Pro) pelo recurso
   *Sign in with ChatGPT* da OpenAI, lançado no DevDay de 29/09/2026 (documentação em
   developers.openai.com/siwc).
2. **Chave de API (alternativa).** NVIDIA, OpenAI, OpenRouter ou endpoint compatível, com chave própria.

A escolha é automática: com a conta ChatGPT conectada e o plano liberado, o Sensus usa o ChatGPT. Caso
contrário, usa a chave de API salva. Sem nada disso, o provedor de demonstração (offline) ou nenhum.

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

| Situação | Código do núcleo | O que o app faz |
|---|---|---|
| 403 `subscription_sharing_user_not_eligible` | `plan_not_eligible` | Marca a conta como não elegível e usa a chave de API, com um aviso (uma vez). Sem novo OAuth. |
| 429 `subscription_sharing_usage_limit_exceeded` | `plan_limit` | Mostra o limite e não repete. |
| 503 `subscription_sharing_usage_unavailable` | `plan_unavailable` | Mantém as credenciais e pede para tentar depois. |
| 400 `subscription_sharing_unsupported_capability` | `plan_unsupported` | Indica o parâmetro recusado. |
| 401 `subscription_sharing_invalid_user` / 401 persistente | `reauth` | Pede novo login. |
| Stream sem `response.completed` | `protocol` | Erro: resposta parcial não é aceita como sucesso. |

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

- `npx vitest run app/src/auth/chatgpt`: a máquina de retorno (cancelamento por folga, fechamento da aba,
  sucesso, settle, temporizadores).
- `npx vitest run packages/core`: PKCE (vetor da RFC 7636), RS256 contra chaves geradas com `node:crypto`,
  callback, troca, renovação, erros de plano e o provedor com fetch falso.
- `cd app && npx tsc --noEmit` e `npx expo-doctor`.
- Teste real de login exige o navegador e a conta da pessoa; não é automatizado.
