/** The presentation reads this shape; a future CMS adapter can replace the fixtures. */
export type EventCategory = 'music' | 'food' | 'community';
export type EventImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
  sourceUrl: string;
};

export type TerraceEvent = {
  slug: string;
  title: string;
  category: EventCategory;
  startsAt: string;
  endsAt?: string;
  location: string;
  excerpt: string;
  description: string;
  image?: EventImage;
  preview: boolean;
};

export type EventSummary = Omit<TerraceEvent, 'description' | 'endsAt'>;

export function summarizeEvent({ description, endsAt, ...summary }: TerraceEvent): EventSummary {
  return summary;
}

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
      title: 'Midnight Soup Symposium',
      category: 'food',
      startsAt: '2026-11-05T23:00:00-05:00',
      endsAt: '2026-11-06T01:00:00-05:00',
      location: 'The kitchen, probably',
      excerpt: 'One enormous pot. Seven strong opinions. An unreasonable defense of soup as a beverage.',
      description: 'An imaginary night for the preview: bring a spoon, a question with no obvious answer, and your most unreasonable soup thesis. The floor is open until the pot is empty. Dessert may invalidate the entire discussion.\n\nIn the real version, this space will carry the menu, ingredients, accessibility details, and how to join. Nothing is booked or scheduled here yet.',
      image: { url: '/culture/berry-pie.webp', alt: 'Berry and citrus pie with a dollop of cream', width: 563, height: 419, caption: 'Actual pie, imaginary event. Fall 2023 newsletter, page 29.', sourceUrl: '/newsletter/fall-2023/#page-29' },
      preview: true
    },
    {
      slug: 'music-in-the-living-room',
      title: 'Feedback for Houseplants',
      category: 'music',
      startsAt: '2026-11-12T20:00:00-05:00',
      endsAt: '2026-11-12T22:00:00-05:00',
      location: 'The solarium',
      excerpt: 'Improvised noise for the ferns. Bring something that makes a sound. The plants are a tough crowd.',
      description: 'A fictional bill for a room full of plants, friends, and improbable instruments. A saucepan counts. So does a cello. The fern has requested an encore and will not be taking questions.\n\nThis is a design sample, with no confirmed performers or tickets. A published listing will include the actual lineup, entry details, and accessibility information.',
      image: { url: '/culture/performance.webp', alt: 'A guitarist plays in the solarium among plants and murals', width: 1440, height: 1080, caption: 'Solarium Sessions · Fall 2023, page 19.', sourceUrl: '/newsletter/fall-2023/#page-19' },
      preview: true
    },
    {
      slug: 'terrans-together',
      title: 'Pool Table Peace Talks',
      category: 'community',
      startsAt: '2026-11-18T19:00:00-05:00',
      endsAt: '2026-11-18T20:30:00-05:00',
      location: 'Under the murals',
      excerpt: 'Old friends. Questionable geometry. All disputes settled by the eight ball.',
      description: 'Imagine an intergenerational gathering around the pool table: alumni teach allegedly reliable trick shots; current members explain why those shots have never worked. Stories are traded. A mysterious house rule is debated for forty minutes.\n\nThis gathering is invented for the preview. When a real one is arranged, this page can share who it is for, how to join, and how people farther away can take part.',
      image: { url: '/culture/pool-room.webp', alt: 'People play pool beneath Terrace’s colorful murals and hanging plants', width: 1440, height: 1080, caption: 'Pool room · Fall 2023, page 9.', sourceUrl: '/newsletter/fall-2023/#page-9' },
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

export function filterEvents<T extends EventSummary>(events: T[], category: EventCategory | 'all'): T[] {
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

export function eventUrl(event: Pick<TerraceEvent, 'slug'>): string {
  return `/events/${encodeURIComponent(event.slug)}/`;
}
