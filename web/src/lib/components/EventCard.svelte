<script lang="ts">
  import { eventDateParts, eventUrl, type TerraceEvent } from '$lib/content';
  export let event: TerraceEvent;
  export let headingTag: 'h2' | 'h3' = 'h3';
  $: date = eventDateParts(event.startsAt);
</script>

<article class="event-card">
  <time class="event-date" datetime={event.startsAt}>
    <span aria-hidden="true">{date.month}</span><strong aria-hidden="true">{date.day}</strong>
    <span class="sr-only">{date.full}</span>
  </time>
  <div class="event-card-body">
    <span class="eyebrow">{event.category}{#if event.preview} <span aria-hidden="true">✦</span> sample event{/if}</span>
    {#if headingTag === 'h2'}
      <h2><a href={eventUrl(event)}>{event.title}<span aria-hidden="true"> ↗</span></a></h2>
    {:else}
      <h3><a href={eventUrl(event)}>{event.title}<span aria-hidden="true"> ↗</span></a></h3>
    {/if}
    <p>{event.excerpt}</p>
    <div class="event-meta">{date.weekday} · {date.time} · {event.location}</div>
  </div>
</article>
