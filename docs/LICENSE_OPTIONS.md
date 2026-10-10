# Opções de licença para o código

Este documento compara quatro licenças aprovadas pela OSI para o código do Sensus (pipeline, núcleo
TypeScript e app). Não trata dos dados: eles seguem `DATA_LICENSES.md`, independentemente da licença
escolhida para o código.

> Não é parecer jurídico. Confirmar os pontos marcados **Verificar** antes de escolher.

## Decisão: AGPL-3.0

**Escolhida pelo responsável:** GNU Affero General Public License, versão 3, "ou posterior"
(`AGPL-3.0-or-later`). Texto completo em [`LICENSE`](../LICENSE). Os `package.json` da raiz, de
`packages/core/` e de `app/` declaram essa licença.

- Motivo: manter o projeto aberto também quando rodado como serviço em rede. Cópias modificadas que
  forem distribuídas ou oferecidas por rede precisam abrir o código-fonte sob a mesma licença.
- "Ou posterior" permite adotar versões futuras da AGPL. Se for preferível fechar a versão, trocar
  para `AGPL-3.0-only` antes de qualquer contribuição externa aceita.
- A licença não se estende aos dados (ver `DATA_LICENSES.md`).
- Pontos ainda **Verificar** da tabela abaixo (App Store e programa da OpenAI) continuam em aberto e não
  foram resolvidos pela decisão.

As seções seguintes são o registro da comparação que levou a essa escolha.

## Contexto do projeto

- Projeto comunitário, não comercial, de estudo bíblico. O objetivo é mantê-lo aberto e público.
- App mobile (Expo / React Native) para iOS e Android.
- Login com ChatGPT (Sign in with ChatGPT). O programa da OpenAI tem elegibilidade para projetos de
  código aberto. **Verificar** nos termos atuais do programa qual licença é exigida, e se é OSI.
- Dados com licenças próprias: CC BY-SA 4.0 (Theographic, que torna o banco share-alike), CC BY,
  uso não comercial (Robertson, RWP) e GPL declarada no pacote do KJV.

## Comparação

| | MIT | Apache-2.0 | GPL-3.0 | AGPL-3.0 |
|---|---|---|---|---|
| Uso comercial | Permitido | Permitido | Permitido | Permitido |
| Código modificado redistribuído precisa ser aberto | Não | Não | Sim, sob GPL | Sim, sob AGPL |
| Quem roda o código como serviço precisa abrir a modificação | Não | Não | Não | Sim (cláusula de rede) |
| Concessão explícita de patente | Não | Sim, com rescisão para quem processa por patente | Sim | Sim |
| Aviso (NOTICE) e mudanças documentadas | Só o aviso de copyright | Sim, arquivo NOTICE e registro de mudanças | Sim, registro de mudanças | Sim, registro de mudanças |
| Tamanho do texto | Curto | Médio | Longo | Longo |
| Compatibilidade | Ampla | Compatível com GPL-3.0 (não com GPL-2.0) | Recebe código Apache-2.0 | Igual à GPL-3.0 |
| Atrito com lojas de apps | Baixo | Baixo | **Verificar** (ver abaixo) | **Verificar** (ver abaixo) |

## Pontos que pesam para este caso

- **Manter aberto contra fork fechado.** MIT e Apache-2.0 permitem que alguém use o código em um
  produto fechado, inclusive comercial. GPL-3.0 e AGPL-3.0 obrigam quem distribui uma versão modificada a
  abrir o código sob a mesma licença. AGPL-3.0 vale também quando a versão modificada roda como serviço
  em rede. Hoje o app não tem servidor próprio (cada usuário usa a própria chave ou conta), então essa
  cláusula pesa pouco no curto prazo, mas vale se houver backend hospedado.
- **Lojas de apps.** A FSF e outros projetos já argumentaram que GPL e AGPL conflitam com os termos
  de distribuição da App Store (restrições adicionais). Houve casos de remoção de apps por isso.
  **Verificar** a posição atual antes de escolher GPL ou AGPL para um app iOS.
- **Patente.** Apache-2.0 e GPL-3.0 concedem patente expressamente. MIT não diz nada sobre patentes.
  Para um projeto de estudo sem empresa por trás, isso costuma ter peso pequeno.
- **Contribuições.** Nenhuma das quatro exige cessão de direitos. Um DCO (`Signed-off-by`) ou um CLA
  facilita uma troca de licença futura, mas é opcional.
- **Dados não mudam com a escolha.** A licença do código não se estende aos dados. O `sensus.db` segue
  as licenças de `DATA_LICENSES.md`. Não há conflito técnico entre uma licença de código e CC BY-SA para
  dados separados.
- **KJV (GPL declarada).** Só afeta o código se o app distribuir o código do módulo SWORD. Com apenas o
  texto extraído, não há vínculo com a licença do código.
- **Uso não comercial.** Nenhuma das quatro restringe uso comercial. Se a intenção é proibir uso comercial,
  as opções são outras (por exemplo, PolyForm Noncommercial ou CC BY-NC). Elas não são licenças de código
  aberto segundo a OSI, então não atendem ao objetivo de manter o projeto aberto.

## Perguntas para decidir

1. Forks fechados e comerciais devem ser permitidos (MIT, Apache-2.0) ou não (GPL-3.0, AGPL-3.0)?
2. Haverá distribuição nas lojas? Isso muda o peso da questão GPL/App Store.
3. Haverá backend hospedado? Se sim, AGPL-3.0 passa a ter efeito prático.
4. Qual licença o programa de elegibilidade da OpenAI exige?

Feito após a decisão: arquivo `LICENSE` na raiz e seção "Licenças" do `README.md` atualizados.
