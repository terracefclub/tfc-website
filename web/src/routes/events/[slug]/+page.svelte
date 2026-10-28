<script lang="ts">
  import { eventDateParts, official } from '$lib/content';
  import type { PageData } from './$types';
  export let data: PageData;
  $: date = eventDateParts(data.event.startsAt);
</script>

<svelte:head><title>{data.event.title} · Terrace F. Club</title><meta name="description" content={data.event.excerpt} /></svelte:head>
<section class="page-hero coral"><div class="shell"><span class="eyebrow">{#if data.event.preview}SAMPLE {/if}{data.event.category.toUpperCase()} EVENT{#if data.event.preview} · DESIGN PREVIEW{/if}</span><h1>{data.event.title}</h1><p>{data.event.excerpt}</p></div></section>
<div class="shell detail-layout">
  <div class="prose"><a class="back-link" href="/events/">← All events</a><h2>About this {data.event.preview ? 'example' : 'gathering'}</h2>{#each data.event.description.split('\n\n') as paragraph}<p>{paragraph}</p>{/each}{#if data.event.preview}<p>This page shows the layout for a future Terrace listing. Check the official calendar before making plans.</p><a class="text-link" href={official.events} target="_blank" rel="noopener noreferrer">Visit the official events calendar <span class="sr-only">(opens in a new tab)</span> ↗</a>{/if}</div>
  <aside class="detail-sidebar"><h2>At a glance</h2><p><strong>Date</strong><br /><time datetime={data.event.startsAt}>{date.full}</time></p><p><strong>Time</strong><br />{date.time}</p><p><strong>Place</strong><br />{data.event.location}</p>{#if data.event.preview}<p><strong>Status</strong><br />Sample listing · not scheduled</p><a class="button button-dark" href={official.events} target="_blank" rel="noopener noreferrer">Official calendar <span aria-hidden="true">↗</span><span class="sr-only">(opens in a new tab)</span></a>{/if}</aside>
</div>
