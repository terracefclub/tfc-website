import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/routes/members/members.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, hex]) => [name, hex]));

function luminance(hex: string): number {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('member palette text pairs meet 4.5:1', () => {
  const pairs = [
    ['ink', 'paper'], ['ink', 'paper-deep'], ['ink', 'card'], ['ink', 'acid'], ['ink', 'acid-soft'], ['ink', 'lilac-soft'],
    ['ink', 'lilac'], ['muted', 'paper'], ['muted', 'paper-deep'], ['muted', 'card'], ['muted', 'lilac-soft'],
    ['paper', 'ink'], ['acid', 'ink'], ['on-dark', 'ink'], ['paper', 'ink-soft'],
  ] as const;
  for (const [foreground, background] of pairs) {
    expect(tokens[foreground], foreground).toBeDefined();
    expect(tokens[background], background).toBeDefined();
    expect(contrast(tokens[foreground], tokens[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('consent switches look off by default and the focus ring survives', () => {
  expect(css).toContain("content: 'OFF'");
  expect(css).toContain("content: 'ON'");
  expect(css).toMatch(/\.members summary:focus-visible[\s\S]*outline: 3px solid/);
});
