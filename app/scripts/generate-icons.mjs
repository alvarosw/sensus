#!/usr/bin/env node
// Gera os PNGs do ícone a partir do SVG aprovado (concept #12, centralizado no centro óptico).
// Fonte: docs/design/icons/final/12-optica*.svg. Saída: app/assets/images/*.png.
//
// Uso (a partir de app/):  npm run icons   (ou: node scripts/generate-icons.mjs)
//
// Cores (tokens de docs/design/icon-concepts.html): papel #F7F5F0 (claro), noite #16130F (escuro).
// Verificação embutida: a marca do ícone adaptativo de Android precisa caber no círculo de 66 dp
// (área segura) de um canvas de 108 dp; em 1024 px, raio = 1024 * (66 / 108) / 2. Falha se não couber.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(APP, '..', 'docs', 'design', 'icons', 'final');
const OUT = resolve(APP, 'assets', 'images');

const PAPER = '#F7F5F0';
const NIGHT = '#16130F';
const SIZE = 1024;
const SAFE_RADIUS = (SIZE * (66 / 108)) / 2;

const read = (name) => readFileSync(resolve(SOURCE, name), 'utf8');

/** Remove o fundo de papel/noite (o <rect> de tela cheia), para a versão transparente. */
function stripBackground(svg) {
  const next = svg.replace(/<rect width="1024" height="1024" fill="#[0-9A-Fa-f]{6}"\/>/, '');
  if (next === svg) throw new Error('fundo não encontrado no SVG');
  return next;
}

/** Pinta de fundo sólido (usado no ícone de iOS "tinted", em tons de cinza sobre preto). */
function withBackground(svg, color) {
  return svg.replace(/(<svg[^>]*>)/, `$1<rect width="1024" height="1024" fill="${color}"/>`);
}

/** Silhueta branca (monocromático do Android 13 e base do tinted). */
function asWhite(svg) {
  return svg.replaceAll('currentColor', '#FFFFFF');
}

function renderPixels(svg, width = SIZE) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render();
}

function render(svg, width = SIZE) {
  return renderPixels(svg, width).asPng();
}

/** Maior distância do centro entre pixels não transparentes (RGBA bruto do resvg). */
function farthestFromCenter(svg) {
  const img = renderPixels(svg);
  const data = img.pixels;
  const { width, height } = img;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  let far = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      far = Math.max(far, Math.hypot(x - cx, y - cy));
    }
  }
  return far;
}

function write(name, png) {
  writeFileSync(resolve(OUT, name), png);
  console.log(`ok  ${name}`);
}

// --- Ícone principal (iOS/legado, papel cheio) -------------------------------------------------
const light = read('12-optica.svg');
const dark = read('12-optica-escuro.svg');
const mono = read('12-optica-mono.svg');

write('icon.png', render(light));
write('favicon.png', render(light, 192));

// --- iOS: variantes escura e tinted (sem transparência) ----------------------------------------
write('ios-icon-dark.png', render(dark));
write('ios-icon-tinted.png', render(withBackground(asWhite(mono), '#000000')));

// --- Android: adaptativo (camadas separadas; fundo é cor sólida em app.config.ts) --------------
const foregroundSvg = stripBackground(light);
const foregroundPng = render(foregroundSvg);
const farthest = farthestFromCenter(foregroundSvg);
if (farthest > SAFE_RADIUS) {
  throw new Error(`marca fora da área segura: ${farthest.toFixed(1)} px > ${SAFE_RADIUS.toFixed(1)} px`);
}
console.log(`area segura ok: maior distância ${farthest.toFixed(1)} px de ${SAFE_RADIUS.toFixed(1)} px (66 dp)`);
write('android-icon-foreground.png', foregroundPng);
write('android-icon-monochrome.png', render(asWhite(mono)));

// --- Tela de abertura (expo-splash-screen): marca transparente, claro e escuro -----------------
write('splash-icon.png', render(stripBackground(light)));
write('splash-icon-dark.png', render(stripBackground(dark)));

console.log(`cores: papel ${PAPER}, noite ${NIGHT}`);
