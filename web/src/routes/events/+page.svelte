<script lang="ts">
  import EventCard from '$lib/components/EventCard.svelte';
  import { filterEvents, official, type EventCategory } from '$lib/content';
  import type { PageData } from './$types';
  export let data: PageData;
  let category: EventCategory | 'all' = 'all';
  $: visibleEvents = filterEvents(data.events, category);
  const filters: { value: EventCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All gatherings' },
    { value: 'music', label: 'Music' },
    { value: 'food', label: 'Food' },
    { value: 'community', label: 'Community' }
  ];
</script>

<svelte:head><title>Events · Terrace F. Club</title><meta name="description" content="Explore food, music, and community gatherings at Terrace Club." /></svelte:head>
<section class="page-hero"><div class="shell"><span class="eyebrow light">GOOD TIMES, GOOD PEOPLE</span><h1>The more,<br /><em>the merrier.</em></h1><p>Find a reason to get together, at the clubhouse and beyond.</p></div></section>
<section class="shell content-section">
  {#if data.preview}<div class="page-note"><strong>Design preview:</strong> The events below are sample content only. <a href={official.events} target="_blank" rel="noopener noreferrer">View the official events page <span class="sr-only">(opens in a new tab)</span> ↗</a></div>{/if}
  <div class="filter-row" aria-label="Filter events by category">{#each filters as filter}<button type="button" aria-pressed={category === filter.value} onclick={() => category = filter.value}>{filter.label}</button>{/each}</div>
  <div class="event-list" aria-live="polite">{#each visibleEvents as event (event.slug)}<EventCard {event} headingTag="h2" />{:else}<p>No gatherings are listed in this category yet. Check back soon.</p>{/each}</div>
</section>
