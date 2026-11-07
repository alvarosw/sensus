// Degradê radial elíptico que funciona igual no aparelho e na web: o círculo unitário esticado por
// gradientTransform (rx/ry em RadialGradient só existem no react-native-svg nativo; o navegador os ignora).
import type { ReactElement } from 'react';
import { RadialGradient } from 'react-native-svg';

export function EllipseGradient({
  id,
  cx,
  cy,
  rx,
  ry = rx,
  fx = cx,
  fy = cy,
  children,
}: {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry?: number;
  fx?: number;
  fy?: number;
  children: ReactElement | ReactElement[];
}) {
  return (
    <RadialGradient
      id={id}
      cx={0}
      cy={0}
      r={1}
      fx={(fx - cx) / rx}
      fy={(fy - cy) / ry}
      gradientUnits="userSpaceOnUse"
      gradientTransform={`translate(${cx} ${cy}) scale(${rx} ${ry})`}
    >
      {Array.isArray(children) ? children : [children]}
    </RadialGradient>
  );
}
