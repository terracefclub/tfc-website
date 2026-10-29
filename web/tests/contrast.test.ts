import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8').split('<style>')[1].split('</style>')[0];
const eventStyles = ['../src/lib/components/EventCard.svelte', '../src/routes/events/+page.svelte']
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').split('<style>')[1].split('</style>')[0]).join('\n');
const css = (readFileSync(new URL('../src/app.css', import.meta.url), 'utf8') + home + eventStyles).replace(/\/\*[\s\S]*?\*\//g, '');

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
  const archive = color('.time-machine', 'background');
  const cases = [
    [color('.page-hero.coral .eyebrow', 'color'), coral],
    [color('.page-hero.yellow .eyebrow', 'color'), yellow],
    [color('.time-machine', 'color'), archive],
    [color('.world-copy p', 'color'), color('.house-world', 'background')],
    [color('.world-kicker', 'color'), color('.house-world', 'background')],
    [color('.acid-button', 'color'), color('.acid-button', 'background')],
    [color('.acid-button', 'color'), color('.acid-button:hover', 'background')],
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
    [color('h1 em', 'color'), color('.house-world', 'background')]
  ];
  for (const [foreground, background] of cases) {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  }
});

test('dual focus ring remains visible on light, warm, and dark surfaces', () => {
  const darkRing = color(':focus-visible', 'outline');
  const lightRing = color(':focus-visible', 'box-shadow');
  for (const surface of ['.page-hero.coral', '.page-hero.yellow', '.time-machine']) {
    expect(contrast(darkRing, color(surface, 'background'))).toBeGreaterThanOrEqual(3);
  }
  expect(contrast(darkRing, '#fbf7eb')).toBeGreaterThanOrEqual(3);
  expect(contrast(lightRing, color('.page-hero', 'background'))).toBeGreaterThanOrEqual(3);
});


test('event posters and night-time header preserve readable body contrast', () => {
  for (const category of ['.event-card', ".event-card[data-category='music']", ".event-card[data-category='community']"]) {
    expect(contrast(color('.event-card', 'color'), color(category, '--poster'))).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(color('.events-hero', 'color'), color('.events-hero', 'background'))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(color('.hero-copy > .overline', 'color'), color('.events-hero', 'background'))).toBeGreaterThanOrEqual(4.5);
});
