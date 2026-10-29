export const archiveTopics = [
  { id: 'all', label: 'Everything' },
  { id: 'food', label: 'Food & recipes' },
  { id: 'music', label: 'Music & shows' },
  { id: 'people', label: 'People' },
  { id: 'place', label: 'Club life' }
] as const;

export type ArchiveTopic = Exclude<(typeof archiveTopics)[number]['id'], 'all'>;

export type ArchiveIssue = {
  slug: string;
  label: string;
  season: string;
  year: number;
  pageCount: number;
  pdfUrl: string;
  cover: string;
  coverAlt: string;
  accent: string;
  note: string;
};

export type ArchiveStory = {
  slug: string;
  issueSlug: string;
  topic: ArchiveTopic;
  title: string;
  page: number;
  endPage?: number;
  image: string;
  imageAlt: string;
  followingPage?: { page: number; image: string; alt: string };
  note: string;
  searchTerms?: string;
};

// These are editorial selections from publicly available Terrace PDFs, not CMS records.
// Every note describes material on its cited page; the linked PDF remains authoritative.
export const archiveIssues: ArchiveIssue[] = [
  {
    slug: 'spring-2026', label: 'Spring 2026', season: 'Spring', year: 2026, pageCount: 14,
    pdfUrl: 'https://princetonterraceclub.org/wp-content/uploads/Spring-Newsletter-2026-6.pdf',
    cover: '/archive/spring-2026-cover.webp',
    coverAlt: 'Spring 2026 Terrace F. Club alumni newsletter cover with floral photography and a clubhouse image',
    accent: 'violet', note: 'Meet the undergrad officers in the spring issue.'
  },
  {
    slug: 'fall-2025', label: 'Fall 2025', season: 'Fall', year: 2025, pageCount: 36,
    pdfUrl: 'https://princetonterraceclub.org/wp-content/uploads/2025_Fall_Newsletter_FINAL_2.pdf',
    cover: '/archive/fall-2025-cover.webp',
    coverAlt: 'Fall 2025 Terrace F. Club newsletter cover with white lettering on rich green texture',
    accent: 'green', note: 'A long issue with music, club life and recipes.'
  },
  {
    slug: 'summer-2024', label: 'Summer 2024', season: 'Summer', year: 2024, pageCount: 19,
    pdfUrl: 'https://princetonterraceclub.org/wp-content/uploads/2024-TFC-Summer-Newsletter-3.pdf',
    cover: '/archive/summer-2024-cover.webp',
    coverAlt: 'Summer 2024 Terrace F. Club newsletter cover with lettering over a colorful painted mural',
    accent: 'orange', note: 'Summer dispatches and a green quiche recipe.'
  },
  {
    slug: 'fall-2023', label: 'Fall 2023', season: 'Fall', year: 2023, pageCount: 33,
    pdfUrl: 'https://princetonterraceclub.org/wp-content/uploads/2023-Newsletter-2.pdf',
    cover: '/archive/fall-2023-cover.webp',
    coverAlt: 'Fall 2023 Terrace newsletter cover with cream lettering over a dark blue architectural design',
    accent: 'blue', note: 'Solarium Sessions, a room makeover and a berry pie.'
  }
];

export const archiveStories: ArchiveStory[] = [
  {
    slug: 'undergrad-officers', issueSlug: 'spring-2026', topic: 'people',
    title: 'Meet the 2026 undergrad officers', page: 3, endPage: 4,
    image: '/archive/spring-2026-p03.webp',
    imageAlt: 'Page 3 of the Spring 2026 newsletter introducing three undergrad officers',
    note: 'The spring issue introduces the 2026 undergrad officers with short self-portraits and favorite Terrace events.',
    searchTerms: 'officers president social chair music chair vice president treasurer house manager'
  },
  {
    slug: 'rice-salad', issueSlug: 'fall-2025', topic: 'food',
    title: 'Rice salad, Barcelona style', page: 32,
    image: '/archive/fall-2025-p32.webp',
    imageAlt: 'Fall 2025 newsletter page 32 with a rice salad recipe and ingredients',
    note: 'John Bussoletti ’72 shares a Penelope Casas rice salad recipe for potlucks, with a lemon and vinegar dressing.',
    searchTerms: 'recipe potluck'
  },
  {
    slug: 'tomato-tarte', issueSlug: 'fall-2025', topic: 'food',
    title: 'Cheese-tomato tarte Provençale', page: 33,
    image: '/archive/fall-2025-p33.webp',
    imageAlt: 'Fall 2025 newsletter page 33 with a cheese and tomato tart recipe',
    followingPage: { page: 34, image: '/archive/fall-2025-p34.webp', alt: 'Fall 2025 newsletter page 34 showing a photograph of the finished cheese-tomato tart' },
    note: 'Jenny Marlowe ’04 shares a late-summer tart with tomatoes, cheese and scallions. A photograph follows on page 34.',
    searchTerms: 'recipe tart'
  },
  {
    slug: 'green-goddess-quiche', issueSlug: 'summer-2024', topic: 'food',
    title: 'Green Goddess Pesto Quiche', page: 17,
    image: '/archive/summer-2024-p17.webp',
    imageAlt: 'Summer 2024 newsletter page 17 showing the Green Goddess Pesto Quiche recipe',
    note: 'Jenny Marlowe ’04 contributes a spinach, parmesan and pesto quiche for summer.',
    searchTerms: 'recipe'
  },
  {
    slug: 'poetry-in-the-solarium', issueSlug: 'fall-2023', topic: 'music',
    title: 'Poetry in the solarium', page: 11,
    image: '/archive/fall-2023-p11.webp',
    imageAlt: 'Fall 2023 newsletter page 11 showing a poetry reading and audience at Solarium Sessions',
    note: 'A photo page captures a slam poetry reading by Terran Madison Linton ’24 at Solarium Sessions.',
    searchTerms: 'show performance open mic'
  },
  {
    slug: 'reunions-rave-poster', issueSlug: 'fall-2023', topic: 'music',
    title: 'A poster for Reunions', page: 15,
    image: '/archive/fall-2023-p15.webp',
    imageAlt: 'Fall 2023 newsletter page 15 with a vivid hand-drawn Reunions 2023 rave poster',
    note: 'The issue reproduces a hand-drawn poster for the Reunions 2023 rave.',
    searchTerms: 'show art music'
  },
  {
    slug: 'solarium-sessions', issueSlug: 'fall-2023', topic: 'music',
    title: 'Solarium Sessions', page: 19,
    image: '/archive/fall-2023-p19.webp',
    imageAlt: 'Fall 2023 newsletter page 19 about the Solarium Sessions open mic',
    note: 'The fall issue describes Solarium Sessions as a monthly open mic for acoustic songs and spoken word.',
    searchTerms: 'show performance poetry'
  },
  {
    slug: 'green-room-sky', issueSlug: 'fall-2023', topic: 'place',
    title: 'A sky for the green room', page: 17,
    image: '/archive/fall-2023-p17.webp',
    imageAlt: 'Fall 2023 newsletter page 17 with a photo of the green room ceiling painted with clouds',
    note: 'A page documents the cloud ceiling painted in the green room during fall break by Molly Trueman ’24 and Jasper Lydon ’24.',
    searchTerms: 'clubhouse art ceiling history'
  },
  {
    slug: 'berry-citrus-pie', issueSlug: 'fall-2023', topic: 'food',
    title: 'New England Berry & Citrus Pie', page: 28, endPage: 29,
    image: '/archive/fall-2023-p28.webp',
    imageAlt: 'Fall 2023 newsletter page 28 with the New England Berry and Citrus Pie recipe',
    followingPage: { page: 29, image: '/archive/fall-2023-p29.webp', alt: 'Fall 2023 newsletter page 29 with directions and a photograph of the berry and citrus pie' },
    note: 'Jenny Marlowe ’04 shares a flexible berry and citrus pie, with directions continuing on the next page.',
    searchTerms: 'recipe fall dessert'
  },
  {
    slug: 'pool-tournament', issueSlug: 'fall-2023', topic: 'place',
    title: 'A pool-table showdown', page: 9,
    image: '/archive/fall-2023-p09.webp',
    imageAlt: 'Fall 2023 newsletter page 9 with a pool tournament photograph and caption',
    note: 'A Terrace pool-table match unfolds beneath the club’s colorful wall murals.',
    searchTerms: 'club life billiards'
  }
];

export function issueBySlug(slug: string): ArchiveIssue | undefined {
  return archiveIssues.find((issue) => issue.slug === slug);
}

export function storiesForIssue(slug: string): ArchiveStory[] {
  return archiveStories.filter((story) => story.issueSlug === slug);
}

export function pdfPageUrl(issue: ArchiveIssue, page: number): string {
  if (!Number.isInteger(page) || page < 1 || page > issue.pageCount) throw new RangeError('Page outside issue');
  return `${issue.pdfUrl}#page=${page}`;
}

export function filterArchiveStories(topic: (typeof archiveTopics)[number]['id'], query: string): ArchiveStory[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return archiveStories.filter((story) => {
    if (topic !== 'all' && story.topic !== topic) return false;
    const issue = issueBySlug(story.issueSlug);
    const haystack = `${story.title} ${story.note} ${story.searchTerms ?? ''} ${issue?.label ?? ''}`.toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
