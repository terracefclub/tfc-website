/** The presentation reads this shape; a future CMS adapter can replace the fixtures. */
export type EventCategory = 'music' | 'food' | 'community';
export type TerraceEvent = {
  slug: string;
  title: string;
  category: EventCategory;
  startsAt: string;
  endsAt?: string;
  location: string;
  excerpt: string;
  description: string;
  image?: string;
  preview: boolean;
};

export type Newsletter = {
  title: string;
  season: string;
  year: number;
  url: string;
};

export type TerraceContent = {
  events: TerraceEvent[];
  newsletters: Newsletter[];
  initiatives?: Initiative[];
};

export type Initiative = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export const official = {
  site: 'https://princetonterraceclub.org',
  events: 'https://princetonterraceclub.org/events/',
  donate: 'https://princetonterraceclub.org/donate/',
  shows: 'https://princetonterraceclub.org/shows-archive/',
  merchandise: 'https://princetonterraceclub.org/merchandise/',
  contact: 'https://princetonterraceclub.org/contact/'
} as const;

// Deliberately illustrative. These are never presented as scheduled Terrace events.
export const fixtureContent: TerraceContent = {
  events: [
    {
      slug: 'supper-at-the-table',
      title: 'Supper at the table',
      category: 'food',
      startsAt: '2026-11-05T18:00:00-05:00',
      endsAt: '2026-11-05T20:00:00-05:00',
      location: 'The clubhouse',
      excerpt: 'A preview of how a shared meal could appear on the Terrace calendar.',
      description: 'This sample event demonstrates the detail page for a clubhouse meal. Details, attendance, and timing are illustrative for the redesign preview.',
      image: '/images/clubhouse.jpg',
      preview: true
    },
    {
      slug: 'music-in-the-living-room',
      title: 'Music in the living room',
      category: 'music',
      startsAt: '2026-11-12T20:00:00-05:00',
      endsAt: '2026-11-12T22:00:00-05:00',
      location: 'The clubhouse',
      excerpt: 'An example of a night for listening, dancing, and being together.',
      description: 'This sample listing shows how a music event would be presented. No performer, ticket, or attendance details have been confirmed.',
      image: '/images/clubhouse-snow.jpg',
      preview: true
    },
    {
      slug: 'terrans-together',
      title: 'Terrans together',
      category: 'community',
      startsAt: '2026-11-18T19:00:00-05:00',
      endsAt: '2026-11-18T20:30:00-05:00',
      location: 'Online',
      excerpt: 'A sample listing for a conversation that connects Terrans near and far.',
      description: 'This sample event shows the format for a community gathering. A real listing would include verified joining information from Terrace.',
      preview: true
    }
  ],
  newsletters: [
    {
      title: 'Spring 2026 Alumni Newsletter',
      season: 'Spring',
      year: 2026,
      url: 'https://princetonterraceclub.org/wp-content/uploads/Spring-Newsletter-2026-6.pdf'
    },
    {
      title: 'Fall 2025 Alumni Newsletter',
      season: 'Fall',
      year: 2025,
      url: 'https://princetonterraceclub.org/wp-content/uploads/2025_Fall_Newsletter_FINAL_2.pdf'
    },
    {
      title: 'Summer 2024 Alumni Newsletter',
      season: 'Summer',
      year: 2024,
      url: 'https://princetonterraceclub.org/wp-content/uploads/2024-TFC-Summer-Newsletter-3.pdf'
    },
    {
      title: 'Fall 2023 Alumni Newsletter',
      season: 'Fall',
      year: 2023,
      url: 'https://princetonterraceclub.org/wp-content/uploads/2023-Newsletter-2.pdf'
    }
  ]
};

export function getEvent(slug: string, content: TerraceContent = fixtureContent): TerraceEvent | undefined {
  return content.events.find((event) => event.slug === slug);
}

export function filterEvents(events: TerraceEvent[], category: EventCategory | 'all'): TerraceEvent[] {
  return events
    .filter((event) => category === 'all' || event.category === category)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

const terraceTimezone = 'America/New_York';

export function eventDateParts(startsAt: string): { month: string; day: string; weekday: string; full: string; time: string } {
  const date = new Date(startsAt);
  const base = { timeZone: terraceTimezone };
  return {
    month: new Intl.DateTimeFormat('en-US', { ...base, month: 'short' }).format(date),
    day: new Intl.DateTimeFormat('en-US', { ...base, day: '2-digit' }).format(date),
    weekday: new Intl.DateTimeFormat('en-US', { ...base, weekday: 'long' }).format(date),
    full: new Intl.DateTimeFormat('en-US', { ...base, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-US', { ...base, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)
  };
}

export function eventUrl(event: TerraceEvent): string {
  return `/events/${encodeURIComponent(event.slug)}/`;
}
