import { describe, expect, test } from 'bun:test';
import { eventDateParts, eventUrl, filterEvents, fixtureContent, getEvent, official } from '../src/lib/content';

describe('content adapter', () => {
  test('event filters preserve chronological order', () => {
    const reversed = [...fixtureContent.events].reverse();
    expect(filterEvents(reversed, 'all').map((event) => event.slug)).toEqual([
      'supper-at-the-table', 'music-in-the-living-room', 'terrans-together'
    ]);
    expect(filterEvents(reversed, 'music').map((event) => event.slug)).toEqual(['music-in-the-living-room']);
  });

  test('event dates remain in the club timezone regardless of visitor timezone', () => {
    expect(eventDateParts('2026-11-05T18:00:00-05:00')).toMatchObject({
      month: 'Nov', day: '05', time: '6:00 PM EST'
    });
  });

  test('detail links resolve and all samples are labeled', () => {
    for (const event of fixtureContent.events) {
      expect(getEvent(event.slug)).toBe(event);
      expect(eventUrl(event)).toBe(`/events/${event.slug}/`);
      expect(event.preview).toBe(true);
    }
    expect(getEvent('missing')).toBeUndefined();
  });

  test('external destinations use HTTPS and verified official host', () => {
    for (const url of [...Object.values(official), ...fixtureContent.newsletters.map((issue) => issue.url)]) {
      const parsed = new URL(url);
      expect(parsed.protocol).toBe('https:');
      expect(parsed.hostname).toBe('princetonterraceclub.org');
    }
  });
});
