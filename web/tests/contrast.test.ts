import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function color(selector: string, property: string): string {
  for (const [, names, declarations] of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    if (!names.split(',').map((name) => name.trim()).includes(selector)) continue;
    const value = declarations.split(';').map((declaration) => declaration.trim())
      .find((declaration) => declaration.startsWith(`${property}:`));
    const hex = value?.match(/#[0-9a-f]{6}/i)?.[0];
    if (hex) return hex;
  }
  throw new Error(`Missing ${property} color for ${selector}`);
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('small text meets 4.5:1 against its section background', () => {
  const coral = color('.page-hero.coral', 'background');
  const yellow = color('.page-hero.yellow', 'background');
  const newsletter = color('.newsletter-band', 'background');
  const cases = [
    [color('.page-hero.coral .eyebrow', 'color'), coral],
    [color('.page-hero.yellow .eyebrow', 'color'), yellow],
    [color('.newsletter-band .eyebrow', 'color'), newsletter],
    [color('.newsletter-band p', 'color'), newsletter],
    [color('.button-coral', 'color'), color('.button-coral', 'background')],
    [color('.button-coral', 'color'), color('.button-coral:hover', 'background')]
  ];
  for (const [foreground, background] of cases) {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  }
});

test('large accent headings meet 3:1 against their section background', () => {
  const cases = [
    [color('.page-hero.coral h1 em', 'color'), color('.page-hero.coral', 'background')],
    [color('.page-hero.yellow h1 em', 'color'), color('.page-hero.yellow', 'background')],
    [color('.newsletter-band h2 em', 'color'), color('.newsletter-band', 'background')]
  ];
  for (const [foreground, background] of cases) {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  }
});

test('dual focus ring remains visible on light, warm, and dark surfaces', () => {
  const darkRing = color(':focus-visible', 'outline');
  const lightRing = color(':focus-visible', 'box-shadow');
  for (const surface of ['.page-hero.coral', '.page-hero.yellow', '.newsletter-band']) {
    expect(contrast(darkRing, color(surface, 'background'))).toBeGreaterThanOrEqual(3);
  }
  expect(contrast(darkRing, '#fbf7eb')).toBeGreaterThanOrEqual(3);
  expect(contrast(lightRing, color('.page-hero', 'background'))).toBeGreaterThanOrEqual(3);
});
