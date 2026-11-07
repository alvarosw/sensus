# Onboarding — a candeia

Primeira abertura do Sensus. Ideia em [IDEAS.md](../IDEAS.md) ("Onboarding"); contrato para o trabalho em paralelo.

## Experiência

1. **Abertura (candeia).** Tela escura. Uma candeia de barro (lâmpada de azeite de mão, como as da Palestina do
   séc. I) acende; a chama tremula. O versículo de Salmos 119:105 está no escuro e aparece onde a luz da candeia
   passa. Primeiro a candeia faz sozinha um caminho lento sobre o texto (revela palavra a palavra); depois o leitor
   pode arrastá-la. Quando o versículo inteiro foi iluminado, surgem o nome "Sensus" e o botão "Começar".
2. **Idioma.** Lista dos 14 idiomas pelo endônimo, com o do aparelho marcado. Trocar aplica na hora.
3. **Bíblia (obrigatório).** Nenhuma Bíblia vem com o app: o passo pede pelo menos uma. A lista é a mesma de
   Configurações > Bíblias (`data/bibles/BiblePicker`): as recomendadas do idioma do app e do inglês, mais as baixadas,
   e o botão "Ver todas as Bíblias" com as demais agrupadas por idioma (idioma do app, inglês, espanhol, demais). Cada
   item baixa pelo ícone à direita (lixeira quando baixada); tocar numa baixada a torna a principal (borda e rótulo
   "Principal"). A primeira baixada vira a principal sozinha. "Continuar" fica fixo embaixo e só libera com uma Bíblia;
   "Pular" some deste passo enquanto não há nenhuma e, nos outros, leva a ele.
4. **Vertente teológica.** "Todas as tradições" (padrão) ou escolher uma ou mais. Grava a mesma preferência da tela
   "Interpretação e comentários". Frase curta: "Você pode mudar isso em Configurações."
5. **Assistente de IA.** O que a IA faz no Sensus (resume e responde citando as fontes), e "Configurar agora" (abre
   Configurações > Assistente de IA) ou "Depois".
6. **Dados de estudo.** O mesmo conteúdo da tela atual `data-setup`: baixar agora (Wi-Fi recomendado) ou depois.
7. **Fim.** A luz se espalha e aparece a conclusão ("Tudo pronto") com um convite a começar ("Sua candeia está acesa.
   Abra um capítulo, toque num versículo e veja o que cada palavra guarda."); o botão "Começar a estudar" abre o
   leitor. O versículo fica só na abertura.

Em todos os passos: uma candeia pequena acesa no topo (CandeiaGlow), "Pular" no canto, progresso discreto (pontos),
voltar. Claro e escuro. Árabe e urdu: texto da direita para a esquerda (fase 1, sem espelhar layout).
Acessibilidade: com "reduzir movimento" do sistema, a abertura mostra o versículo já iluminado, sem animação; tudo
alcançável por leitor de tela (o versículo é um texto real, não imagem).

## Quem vê

- Instalação nova: sim (antes da oferta de dados de estudo, que vira o passo 6).
- Quem já usa o app (preferências gravadas sem `onboardingDone`): não; grava `onboardingDone: true` na primeira
  carga. Configurações > Sobre ganha "Rever a apresentação".
- Quem já viu a apresentação e está sem nenhuma Bíblia baixada (atualizou de uma versão que trazia BLivre e KJV no
  APK): só o passo de Bíblia ("Escolha sua Bíblia"), sem voltar nem pular, antes de qualquer outra oferta
  (`OnboardingGate`, modo `bibleOnly` do modelo).

## Divisão do código

| Parte | Dono | Arquivos |
|---|---|---|
| Visual da candeia (lâmpada, chama, luz que revela texto, final) | agente Opus | `app/src/features/onboarding/candeia/**` |
| Fluxo, passos, regra de quem vê, preferência, textos (14 idiomas), rota, Configurações | agente Haiku | resto de `app/src/features/onboarding/**`, `app/src/app/onboarding.tsx`, `app/src/app/_layout.tsx`, `app/src/settings/**`, `app/src/i18n/locales/**` |

### Contrato da candeia (`app/src/features/onboarding/candeia/index.tsx`)

Todo texto vem por props (a candeia não lê i18n nem stores).

```ts
export interface CandeiaSceneProps {
  title: string;      // "Sensus"
  verse: string;      // Sl 119:105 no idioma do app
  reference: string;  // "Salmos 119:105 · BLivre"
  hint: string;       // "Arraste a candeia para iluminar"
  ctaLabel: string;   // "Começar"
  onContinue: () => void;
  rtl?: boolean;
  testID?: string;    // botão: `${testID}-continue`
}
export function CandeiaScene(props: CandeiaSceneProps): React.JSX.Element;

export interface CandeiaGlowProps { size?: number; testID?: string }
/** Candeia pequena acesa (chama tremulando) para o topo dos passos. */
export function CandeiaGlow(props: CandeiaGlowProps): React.JSX.Element;

export interface CandeiaFinaleProps {
  verse: string; reference: string; ctaLabel: string; onDone: () => void; rtl?: boolean; testID?: string;
}
/** Fecho: a luz cresce até encher a tela; botão para entrar no app. */
export function CandeiaFinale(props: CandeiaFinaleProps): React.JSX.Element;
```

## Salmos 119:105 por idioma (de Bíblias livres do catálogo)

| Idioma | Texto | Referência |
|---|---|---|
| pt | Tua palavra é lâmpada para meus pés e luz para meu caminho. | Salmos 119:105 · BLivre |
| en | Your word is a lamp to my feet, and a light for my path. | Psalm 119:105 · WEB |
| es | Lámpara es a mis pies tu palabra, y lumbrera a mi camino. | Salmos 119:105 · BLM |
| fr | Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. | Psaume 119:105 · SBL |
| de | Dein Wort ist Leuchte meinem Fuße und Licht für meinen Pfad. | Psalm 119,105 · ELO |
| ru | Слово Твое — светильник ноге моей и свет стезе моей. | Псалом 118:105 · Синодальный |
| zh | 你的话是我脚前的灯，是我路上的光。 | 诗篇 119:105 · 当代译本 |
| ja | あなたの言葉は私の足のともしび、私の道の光である。 | 詩篇 119:105 · FB |
| hi | तेरा वचन मेरे पाँव के लिये दीपक, और मेरे मार्ग के लिये उजियाला है। | भजन संहिता 119:105 · IRV |
| bn | তোমার বাক্য আমার চরণের প্রদীপ, এবং আমার চলার পথের আলো। | গীতসংহিতা 119:105 · OBCV |
| ur | آپ کا کلام میرے قدموں کے لیٔے چراغ، اَور میری راہ کے لیٔے رَوشنی ہے۔ | زبور 119:105 · OUCV |
| ar | سراج لرجلي كلامك ونور لسبيلي. | مزمور 119:105 · فاندايك |
| id | Your word is a lamp to my feet, and a light for my path. | Mazmur 119:105 · WEB (sem Bíblia indonésia livre) |
| vi | Lời Chúa là đèn soi bước chân con, là ánh sáng cho đường con bước. | Thi Thiên 119:105 · VCB |
