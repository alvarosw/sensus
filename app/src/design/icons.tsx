// Ícones do design system (traço 1.8–2, cantos arredondados), desenhados em SVG para seguir o protótipo.
import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'menu'
  | 'chevronUp'
  | 'chevronDown'
  | 'chevronRight'
  | 'chevronLeft'
  | 'close'
  | 'back'
  | 'send'
  | 'chat'
  | 'minus'
  | 'more'
  | 'pin'
  | 'search'
  | 'gear'
  | 'alert'
  | 'check';

// Engrenagem (contorno com furo central), a mesma da proposta de Configurações.
const GEAR_PATH =
  'M9.23 4.92L9.93 2.73L14.07 2.73L14.77 4.92L15.05 5.04L17.09 3.98L20.02 6.91L18.96 8.95L19.08 9.23L21.27 9.93L21.27 14.07L19.08 14.77L18.96 15.05L20.02 17.09L17.09 20.02L15.05 18.96L14.77 19.08L14.07 21.27L9.93 21.27L9.23 19.08L8.95 18.96L6.91 20.02L3.98 17.09L5.04 15.05L4.92 14.77L2.73 14.07L2.73 9.93L4.92 9.23L5.04 8.95L3.98 6.91L6.91 3.98L8.95 5.04Z M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0Z';

export function Icon({ name, size = 16, color }: { name: IconName; size?: number; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'menu':
      return <Svg width={size} height={size} viewBox="0 0 18 18"><Path d="M3 4h12M3 9h12M3 14h8" {...common} strokeWidth={1.8} /></Svg>;
    case 'chevronUp':
      return <Svg width={size} height={size} viewBox="0 0 14 14"><Path d="M3 9l4-4 4 4" {...common} /></Svg>;
    case 'chevronDown':
      return <Svg width={size} height={size} viewBox="0 0 14 14"><Path d="M3 5l4 4 4-4" {...common} /></Svg>;
    case 'chevronRight':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M9 6l6 6-6 6" {...common} /></Svg>;
    case 'chevronLeft':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M15 5l-7 7 7 7" {...common} /></Svg>;
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
    case 'gear':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={color} fillRule="evenodd" d={GEAR_PATH} /></Svg>;
    case 'alert':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9.5" {...common} strokeWidth={2.2} />
          <Path d="M12 7.5v5.5M12 16.2v.3" {...common} strokeWidth={2.2} />
        </Svg>
      );
    case 'check':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 12.5l4.5 4.5L19 7.5" {...common} strokeWidth={2.6} /></Svg>;
  }
}
