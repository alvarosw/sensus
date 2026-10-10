// Ícones do design system (traço 1.8–2, cantos arredondados), desenhados em SVG para seguir o protótipo.
import Svg, { Path } from 'react-native-svg';

export type IconName = 'menu' | 'chevronUp' | 'chevronDown' | 'close' | 'back' | 'send' | 'chat' | 'minus' | 'more' | 'pin' | 'search';

export function Icon({ name, size = 16, color }: { name: IconName; size?: number; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'menu':
      return <Svg width={size} height={size} viewBox="0 0 18 18"><Path d="M3 4h12M3 9h12M3 14h8" {...common} strokeWidth={1.8} /></Svg>;
    case 'chevronUp':
      return <Svg width={size} height={size} viewBox="0 0 14 14"><Path d="M3 9l4-4 4 4" {...common} /></Svg>;
    case 'chevronDown':
      return <Svg width={size} height={size} viewBox="0 0 14 14"><Path d="M3 5l4 4 4-4" {...common} /></Svg>;
    case 'close':
      return <Svg width={size} height={size} viewBox="0 0 12 12"><Path d="M2 2l8 8M10 2l-8 8" {...common} /></Svg>;
    case 'back':
      return <Svg width={size} height={size} viewBox="0 0 14 14"><Path d="M9 2L4 7l5 5" {...common} /></Svg>;
    case 'send':
      return <Svg width={size} height={size} viewBox="0 0 16 16"><Path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" {...common} /></Svg>;
    case 'chat':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 5h16v11H9l-5 4z" {...common} />
          <Path d="M9 10h6" {...common} />
        </Svg>
      );
    case 'minus':
      return <Svg width={size} height={size} viewBox="0 0 12 12"><Path d="M2 6h8" {...common} /></Svg>;
    case 'more':
      return <Svg width={size} height={size} viewBox="0 0 16 16"><Path d="M3 8h.01M8 8h.01M13 8h.01" {...common} strokeWidth={2.6} /></Svg>;
    case 'pin':
      return <Svg width={size} height={size} viewBox="0 0 16 16"><Path d="M6 2h4l-1 4 3 3H4l3-3zM8 9v5" {...common} /></Svg>;
    case 'search':
      return <Svg width={size} height={size} viewBox="0 0 16 16"><Path d="M7 12A5 5 0 107 2a5 5 0 000 10zM11 11l3 3" {...common} /></Svg>;
  }
}
