// Paleta da candeia: o único lugar com cores da cena. A abertura é sempre noturna (é a cena, não segue o tema do
// sistema); a candeia pequena (CandeiaGlow) e o fecho (CandeiaFinale) têm uma variante por tema, que conversa com
// as cores de tokens.ts sem repeti-las à mão (o fundo e o texto do tema vêm de useTheme()).
//
// Noite: escuridão quente de óleo queimado, nunca preto puro. Barro: terracota cozida, das cores de uma candeia
// herodiana real (ocre avermelhado, com a sombra puxando para o marrom). Chama: núcleo quase branco, corpo âmbar,
// borda alaranjada e base azulada (a parte da chama onde o azeite ainda está queimando sem fuligem).
import type { Scheme } from '@/design';

/** Escuridão da cena e o que a luz revela. */
export const night = {
  /** Fundo e véu: a mesma cor, para o véu não aparecer como mancha. */
  dark: '#110C08',
  /** Cantos da cena (vinheta), por cima do véu. */
  vignette: '#050302',
  /** Texto do versículo plenamente iluminado: papel velho à luz de vela. */
  lit: '#F5E6C8',
  /** Brilho residual (brasa) do que já foi iluminado. */
  ember: '#D08A4E',
  /** Referência, dica e textos secundários na penumbra. */
  dim: '#A88E6E',
  /** Título "Sensus". */
  title: '#FBEFD8',
  /** Halo do título e borda do botão. */
  gold: '#E8B46A',
  /** Brilho em volta das letras do título. */
  titleGlow: 'rgba(232,180,106,0.42)',
  /** Fundo translúcido do botão. */
  goldWash: 'rgba(232,180,106,0.10)',
  goldWashPressed: 'rgba(232,180,106,0.22)',
} as const;

/** Luz da chama no ar (poça de luz e halo). */
export const light = {
  /** Poça larga: o ar aquecido em volta da chama. */
  pool: '#FF9F45',
  /** Halo junto da chama (bloom). */
  bloom: '#FFC979',
  /** Brilho mais quente, quase branco, colado na chama. */
  hot: '#FFE7B8',
} as const;

/** Chama, de dentro para fora. */
export const flame = {
  core: '#FFFDF4',
  coreEdge: '#FFF1C6',
  body: '#FFD27A',
  bodyDeep: '#FFAE3D',
  rim: '#F2731C',
  tip: '#C8400E',
  blue: '#5E7BFF',
  blueDeep: '#2B3FBF',
  wick: '#1A0F0A',
  wickGlow: '#FF6A1F',
} as const;

/** Barro cozido da candeia. */
export const clay = {
  /** Face voltada para a chama. */
  lit: '#E39A62',
  /** Terracota no meio-tom. */
  mid: '#B4643A',
  /** Lado de sombra. */
  shade: '#6E351C',
  /** Sombra mais funda (base, interior do furo, oclusão). */
  deep: '#2E140A',
  /** Topo (ombro) da candeia, que recebe mais luz. */
  top: '#C97A4A',
  topLit: '#E9A46C',
  /** Incisões da roseta e dos sulcos. */
  incise: '#5A2914',
  /** Aresta das incisões que pega luz. */
  inciseLit: '#F5C08C',
  /** Luz de borda (contorno iluminado pela própria chama). */
  rim: '#FFD08A',
  /** Grãos minerais do barro. */
  grit: '#F7D3A8',
  gritDark: '#3B1A0C',
  /** Azeite no furo de enchimento. */
  oil: '#1B0D05',
  oilGlint: '#FFCF8A',
} as const;

/** Candeia pequena e fecho, por tema. */
export interface ThemedCandeia {
  /** Halo atrás da candeia pequena. */
  halo: string;
  haloOpacity: number;
  /** Fundo noturno de onde o fecho parte. */
  dusk: string;
  /** Frente da luz que inunda a tela no fecho (a borda dourada da onda). */
  wave: string;
  /** Fração do raio da onda que já é a cor do tema; no escuro a frente é mais larga e mais suave. */
  waveSpread: number;
  waveGlow: number;
}

export const themed: Record<Scheme, ThemedCandeia> = {
  light: { halo: '#F2A64A', haloOpacity: 0.34, dusk: '#1A120C', wave: '#FFD99A', waveSpread: 0.58, waveGlow: 0.95 },
  dark: { halo: '#FFB65C', haloOpacity: 0.42, dusk: '#0E0906', wave: '#B9752F', waveSpread: 0.22, waveGlow: 0.5 },
};
