# Ideias

Ideias registradas durante o trabalho, para avaliar depois. Não são compromisso; o que for aprovado vai para o
[BACKLOG.md](BACKLOG.md) com prioridade.

## Onboarding (pedido do responsável)

- **Primeira abertura em passos curtos**: (1) idioma do app, já sugerido pelo aparelho; (2) Bíblia — a recomendada do
  idioma, com "baixar agora" ou "depois"; (3) vertente teológica — "Quero ver todas as tradições" ou escolher uma ou
  mais (grava a mesma preferência da tela "Interpretação e comentários"); (4) assistente de IA (entrar com o ChatGPT,
  chave própria ou pular); (5) dados de estudo completos (tamanho e Wi-Fi).
- Cada passo pode ser pulado e refeito em Configurações. O onboarding só grava preferências que já existem; não cria
  estado próprio.
- Mostrar no passo 3 um exemplo real (ex.: Dn 8:14) com o que cada tradição diz, para a escolha ser informada.

## Idiomas

- **Nomes próprios por idioma**: generalizar `nomes_pt.py` (nomes alinhados à Bíblia Livre) para qualquer idioma,
  alinhando entidades à Bíblia recomendada de cada idioma. Hoje os nomes e títulos revisados só existem em pt.
- **Espelhar o layout em árabe e urdu** (`I18nManager.forceRTL` + reinício), depois de revisar alças de seleção,
  linha do tempo e mapa.
- **Tradução nativa da Apple no iOS** (framework Translation, iOS 18+), com o ML Kit como alternativa; hoje os dois
  sistemas usam o ML Kit. O idioma do app já define o par de tradução.
- **Revisão das traduções da interface por falantes nativos**: arquivo por idioma facilita receber correções da
  comunidade (pull request por idioma, com uma lista "a revisar").
- Prompt da IA no idioma do app (hoje o prompt é pt-BR e só a resposta segue o idioma).

## Bíblias

- **Leitura paralela**: duas Bíblias lado a lado (ex.: BLivre e RVR1909), versículo a versículo.
- **Aviso de Bíblia nova** no catálogo para o idioma do usuário.
- **Deuterocanônicos** como pacote opcional (útil para leitores católicos e ortodoxos), com versificação própria.
- **Versificação TVTMS** (STEPBible) para mapear Bíblias com numeração diferente da KJV sem regras à mão.
- Áudio da Bíblia em domínio público (ex.: gravações livres da WEB), se houver fonte com licença clara.

## Fontes de interpretação

- **Tradição como contexto da IA**: quando o leitor escolhe só uma vertente, dizer isso ao modelo para que a síntese
  não "equilibre" com tradições que o leitor escondeu, mas sem inventar o que as fontes não dizem.
- **Comparar tradições** num trecho: uma vista que põe lado a lado o que cada tradição diz (a mesma lente, agrupada).
- **Comentários em outros idiomas**: obras em domínio público já traduzidas (ex.: Lutero em alemão, Calvino em
  francês, Spurgeon), para leitores que não querem tradução automática.
- **Mais vertentes**: pentecostal/holiness (ex.: obras antigas de domínio público), ortodoxa oriental (patrística
  grega já cobre parte), anabatista/menonita.

## Dados e operação

- **Checagem de fontes na release**: `scripts/release-data.sh` comparar a lista de fontes do banco novo com a do
  anterior e pedir confirmação se alguma sumir (complementa a trava do `build_db.py`).
- **Limpeza de worktrees antigos**: há mais de 30 em `.claude/worktrees`, e o disco está em 92%. Vários têm `data/`
  própria com centenas de MB.
- **Staging única**: o checkout principal e os worktrees dividem `data/` por symlink, para não haver duas stagings
  diferentes (foi o que causou a perda das fontes adventistas em 2026.10.18.1).
