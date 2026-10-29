<script lang="ts">
  import EventCard from '$lib/components/EventCard.svelte';
  import { filterEvents, official, type EventCategory } from '$lib/content';
  import type { PageData } from './$types';
  export let data: PageData;
  let category: EventCategory | 'all' = 'all';
  $: visibleEvents = filterEvents(data.events, category);
  const filters: { value: EventCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'Everything' },
    { value: 'music', label: 'Music' },
    { value: 'food', label: 'Food' },
    { value: 'community', label: 'Community' }
  ];
</script>

<svelte:head><title>Events · Terrace F. Club</title><meta name="description" content="Food, music, and very good company. Find your next night at Terrace." /></svelte:head>
<div class="events-world">
  <section class="events-hero">
    <div class="shell hero-grid">
      <div class="hero-copy"><p class="overline">TERRACE F. CLUB / COME AS YOU ARE</p><h1>THE HOUSE<br />IS <em>ALIVE.</em></h1><p class="hero-intro">A good meal. A loud room. Someone teaching you something at 1 a.m. There’s usually a reason to stay.</p><a class="bill-link" href="#the-bill">See what’s on the wall <span aria-hidden="true">↓</span></a></div>
      <figure class="hero-photo"><img src="/culture/performance.webp" alt="A guitarist plays in the solarium, surrounded by plants, string lights, and a colorful winged mural" width="1440" height="1080" fetchpriority="high" /><span class="photo-stamp" aria-hidden="true">FOOD<br />IS LOVE.</span><figcaption>IN THE SOLARIUM · FROM THE FALL 2023 ARCHIVE <a href="/newsletter/fall-2023/#page-19">Turn the page ↗</a></figcaption></figure>
    </div>
    <div class="house-strip" aria-hidden="true"><span>MUSIC</span><span>FOOD</span><span>ART</span><span>PEOPLE</span><span>REPEAT ↺</span></div>
  </section>
  <section class="shell bill" id="the-bill" aria-labelledby="bill-title">
    <div class="bill-heading"><div><p class="overline">PIN IT UP. PASS IT ON.</p><h2 id="bill-title">The noticeboard.</h2></div><p>At the house. Across the years.<br />A reason to find each other.</p></div>
    {#if data.preview}<div class="preview-note"><strong>Imagined nights. Real Terrace spirit.</strong><p>The listings below are sample content only, dreamed up for this preview. None are scheduled. <a href={official.events} target="_blank" rel="noopener noreferrer">Check the official calendar before making plans <span class="sr-only">(opens in a new tab)</span> ↗</a></p></div>{/if}
    <div class="filter-row" aria-label="Filter events by category">{#each filters as filter}<button type="button" aria-pressed={category === filter.value} onclick={() => category = filter.value}>{filter.label}</button>{/each}</div>
    <div class="event-list" aria-live="polite">{#each visibleEvents as event (event.slug)}<EventCard {event} headingTag="h2" />{:else}<p>No gatherings are listed in this category yet. Check back soon.</p>{/each}</div>
  </section>
  <aside class="archive-invite shell"><span aria-hidden="true">↶</span><div><p class="overline">THERE’S A WHOLE BACK CATALOGUE</p><h2>Missed a decade?</h2><p>Follow the music, meet an old officer core, or make something good from the recipe pages.</p></div><a class="button button-dark" href="/newsletter/">Fall into the archive ↗</a></aside>
</div>

<style>
  .events-world { color:#33253a; background:#f3ecda; overflow:clip; }
  .events-hero { padding-top:64px; background:#33253a; color:#fff7df; }
  .hero-grid { display:grid; grid-template-columns:1fr 1.05fr; align-items:center; gap:60px; padding-bottom:74px; }
  .overline { font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
  .hero-copy > .overline { color:#e5e785; margin-bottom:30px; }
  h1 { margin:0 0 30px; font:400 clamp(70px,8.5vw,122px)/.96 'Anton',Impact,sans-serif; letter-spacing:-.025em; }
  h1 em { color:#e5e785; font-style:normal; }
  .hero-intro { max-width:390px; font-size:16px; line-height:1.8; }
  .bill-link { display:inline-flex; gap:36px; border-bottom:1px solid #e5e785; padding-block:12px; color:#e5e785; font-weight:800; font-size:12px; }
  .hero-photo { position:relative; margin:0; transform:rotate(2deg); background:#fff7df; padding:12px; color:#33253a; box-shadow:13px 14px 0 #e5e785; }
  .hero-photo img { width:100%; height:auto; }
  .hero-photo figcaption { padding:15px 4px 7px; font-size:9px; font-weight:800; line-height:1.6; letter-spacing:.04em; }
  .hero-photo figcaption a { display:block; margin-top:7px; font-size:12px; text-decoration:underline; }
  .photo-stamp { position:absolute; right:-22px; bottom:0; display:grid; place-content:center; width:100px; height:100px; background:#e5e785; border:2px solid #33253a; border-radius:50%; text-align:center; font:700 19px/1 'Fraunces Variable',Georgia,serif; transform:rotate(-12deg); }
  .house-strip { display:flex; flex-wrap:wrap; justify-content:space-around; gap:20px; padding:17px; border-block:1px solid #33253a; color:#33253a; background:#e5e785; font:400 clamp(20px,2.5vw,32px)/1 'Anton',Impact,sans-serif; letter-spacing:.03em; }
  .bill { padding-block:78px 100px; scroll-margin-top:24px; }
  .bill-heading { display:flex; justify-content:space-between; align-items:end; gap:30px; }
  .bill-heading h2 { margin:0; font-size:clamp(45px,5vw,70px); }
  .bill-heading > p { font-size:13px; }
  .preview-note { display:flex; gap:30px; align-items:center; margin-top:34px; padding:20px 24px; background:#e8dfcb; border-left:4px solid #33253a; }
  .preview-note > strong { flex:0 0 170px; font:700 22px/1.15 'Fraunces Variable',Georgia,serif; }
  .preview-note p { margin:0; font-size:12px; line-height:1.7; }
  .preview-note a { text-decoration:underline; font-weight:700; }
  .filter-row button { border-radius:0; border-color:#33253a; color:#33253a; }
  .filter-row button:hover,.filter-row button[aria-pressed='true'] { background:#33253a; color:#fff7df; }
  .event-list { grid-template-columns:repeat(3,minmax(0,1fr)); gap:28px; align-items:start; }
  .archive-invite { display:flex; align-items:center; gap:30px; padding-block:0 90px; }
  .archive-invite > span { font-size:95px; line-height:1; }
  .archive-invite h2 { font-size:38px; margin-bottom:12px; }
  .archive-invite p { max-width:520px; font-size:13px; }
  .archive-invite .button { margin-left:auto; flex-shrink:0; }
  @media(max-width:1000px) { .hero-grid { gap:35px; } .event-list { grid-template-columns:repeat(2,minmax(0,1fr)); } .photo-stamp { right:-8px; width:82px; height:82px; font-size:16px; } }
  @media(max-width:700px) { .events-hero { padding-top:42px; } .hero-grid { grid-template-columns:1fr; gap:40px; padding-bottom:50px; } h1 { font-size:clamp(72px,15vw,106px); } .hero-copy > .overline { margin-bottom:22px; } .hero-photo { margin-inline:8px; } .hero-intro { max-width:440px; } .house-strip { gap:15px; } .bill { padding-block:55px 65px; } .bill-heading { display:block; } .bill-heading > p { margin-top:20px; } .preview-note { display:block; padding:20px; } .preview-note p { margin-top:12px; } .event-list { grid-template-columns:minmax(0,1fr); gap:35px; } .archive-invite { display:block; padding-bottom:60px; } .archive-invite > span { display:none; } .archive-invite .button { margin-top:12px; } }
</style>
