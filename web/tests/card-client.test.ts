import { expect, test } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { compile } from 'svelte/compiler';
import { fixtureContent } from '../src/lib/content';

test('reused event card refreshes its date and heading after a filter changes the event', async () => {
  const browser = new Window({ url: 'http://localhost/' });
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    navigator: browser.navigator,
    Element: browser.Element,
    HTMLElement: browser.HTMLElement,
    Node: browser.Node,
    Text: browser.Text,
    Comment: browser.Comment,
    MutationObserver: browser.MutationObserver
  });

  const source = (await readFile(new URL('../src/lib/components/EventCard.svelte', import.meta.url), 'utf8'))
    .replace("from '$lib/content'", "from '../src/lib/content/index.ts'");
  const compiled = compile(source, { filename: 'EventCard.svelte', generate: 'client', compatibility: { componentApi: 4 } });
  const outDir = new URL('../.test-artifacts/', import.meta.url);
  await mkdir(outDir, { recursive: true });
  const outFile = new URL('EventCard.mjs', outDir);
  await writeFile(outFile, compiled.js.code);
  try {
    const { default: EventCard } = await import(outFile.href);
    const { tick } = await import('svelte');
    const card = new EventCard({ target: browser.document.body, props: { event: fixtureContent.events[0], headingTag: 'h2' } });
    await tick();
    expect(browser.document.body.textContent).toContain('Midnight Soup Symposium');
    expect(browser.document.body.textContent).toContain('Nov05');
    expect(browser.document.querySelector('h2')).not.toBeNull();
    expect(browser.document.querySelector('img')?.getAttribute('src')).toBe('/culture/berry-pie.webp');

    card.$set({ event: fixtureContent.events[1] });
    await tick();
    expect(browser.document.body.textContent).toContain('Feedback for Houseplants');
    expect(browser.document.body.textContent).toContain('Nov12');
    expect(browser.document.querySelector('img')?.getAttribute('src')).toBe('/culture/performance.webp');
    expect(browser.document.body.textContent).toContain('not scheduled');
    expect(browser.document.body.textContent).toContain('8:00 PM EST');
    expect(browser.document.body.textContent).not.toContain('11:00 PM EST');
    card.$destroy();
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await browser.happyDOM.abort();
  }
});
