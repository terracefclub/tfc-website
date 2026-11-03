<script lang="ts">
  import { eventDateParts, eventUrl, type EventSummary } from '$lib/content';
  export let event: EventSummary;
  export let headingTag: 'h2' | 'h3' = 'h3';
  $: date = eventDateParts(event.startsAt);
</script>

<article class="event-card" data-category={event.category}>
  <div class="poster-topline">
    <span>{event.category}</span>
    {#if event.preview}<span class="sample-label">Sample event · not scheduled</span>{/if}
  </div>
  {#if event.image}
    <figure class="event-photo">
      <a href={eventUrl(event)} tabindex="-1"><img src={event.image.url} alt={event.image.alt} width={event.image.width} height={event.image.height} loading="lazy" /></a>
      {#if event.image.caption || event.image.credit}
        <figcaption>
          {#if event.image.sourceUrl}<a href={event.image.sourceUrl}>{event.image.caption} <span aria-hidden="true">↗</span></a>{:else if event.image.caption}{event.image.caption}{/if}
          {#if event.image.credit}<span class="image-credit">{event.image.caption ? ' · ' : ''}{event.image.credit}</span>{/if}
        </figcaption>
      {/if}
    </figure>
  {/if}
  <div class="event-card-body">
    <time class="event-date" datetime={event.startsAt}>
      <span aria-hidden="true">{date.month}</span><strong aria-hidden="true">{date.day}</strong>
      <span class="sr-only">{date.full}</span>
    </time>
    {#if headingTag === 'h2'}
      <h2><a href={eventUrl(event)}>{event.title}<span aria-hidden="true"> ↗</span></a></h2>
    {:else}
      <h3><a href={eventUrl(event)}>{event.title}<span aria-hidden="true"> ↗</span></a></h3>
    {/if}
    <p>{event.excerpt}</p>
    <div class="event-meta">{date.weekday} · {date.time}<br />{event.location}</div>
  </div>
</article>

<style>
  .event-card { --poster:#f4d866; display:flex; flex-direction:column; align-self:start; gap:0; min-height:0; padding:0; border:1px solid #33253a; background:var(--poster); color:#33253a; box-shadow:5px 6px 0 #33253a; }
  .event-card[data-category='music'] { --poster:#efaab6; border-color:#33253a; }
  .event-card[data-category='community'] { --poster:#b7d6d8; border-color:#33253a; }
  .poster-topline { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 17px; border-bottom:1px solid #33253a; font-size:12px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
  .sample-label { font-size:11px; letter-spacing:0; text-align:right; }
  .event-photo { margin:0; padding:14px 14px 0; }
  .event-photo img { display:block; width:100%; height:auto; max-height:520px; object-fit:contain; filter:saturate(.93); }
  .event-photo figcaption { padding:9px 0 2px; font-size:12px; line-height:1.4; }
  .event-photo figcaption a { text-decoration:underline; text-underline-offset:2px; }
  .event-card-body { display:block; padding:19px 22px 24px; }
  .event-date { display:inline-flex; flex-direction:row; gap:5px; width:auto; padding:6px 9px; margin-bottom:15px; background:#33253a; color:#fffaf0; }
  .event-date strong { font-family:'DM Sans Variable',sans-serif; font-size:14px; letter-spacing:.02em; }
  .event-date span { font-size:12px; }
  .event-card h2,.event-card h3 { margin:0 0 17px; font-family:'Anton',Impact,sans-serif; font-size:clamp(33px,3.5vw,54px); font-weight:400; letter-spacing:-.015em; line-height:1.05; text-transform:uppercase; overflow-wrap:anywhere; }
  .event-card h2 a:hover,.event-card h3 a:hover { color:#33253a; text-decoration:underline; text-decoration-thickness:2px; text-underline-offset:4px; }
  .event-card p { color:#33253a; font-size:16px; line-height:1.65; margin-bottom:22px; }
  .event-meta { border-top:1px solid #33253a75; padding-top:15px; font-size:13px; line-height:1.6; }
  @media(max-width:700px) { .event-card h2,.event-card h3 { font-size:44px; } }
</style>
