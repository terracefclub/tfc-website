<script lang="ts">
  import EventCard from '$lib/components/EventCard.svelte';
  import { filterEvents, fixtureContent, official, type EventCategory } from '$lib/content';
  let category: EventCategory | 'all' = 'all';
  $: visibleEvents = filterEvents(fixtureContent.events, category);
  const filters: { value: EventCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All gatherings' },
    { value: 'music', label: 'Music' },
    { value: 'food', label: 'Food' },
    { value: 'community', label: 'Community' }
  ];
</script>

<svelte:head><title>Events · Terrace F. Club</title><meta name="description" content="Explore a preview of Terrace Club's new events calendar and check the official calendar for confirmed gatherings." /></svelte:head>
<section class="page-hero"><div class="shell"><span class="eyebrow light">GOOD TIMES, GOOD PEOPLE</span><h1>The more,<br /><em>the merrier.</em></h1><p>There’s always something to bring us together. This is a preview of how Terrace events could be explored.</p></div></section>
<section class="shell content-section">
  <div class="page-note"><strong>Design preview:</strong> The events below are sample content only. No upcoming events are currently listed on Terrace’s official calendar. <a href={official.events} target="_blank" rel="noopener noreferrer">View the official events page <span class="sr-only">(opens in a new tab)</span> ↗</a></div>
  <div class="filter-row" aria-label="Filter sample events by category">{#each filters as filter}<button type="button" aria-pressed={category === filter.value} onclick={() => category = filter.value}>{filter.label}</button>{/each}</div>
  <div class="event-list" aria-live="polite">{#each visibleEvents as event (event.slug)}<EventCard {event} headingTag="h2" />{/each}</div>
</section>
