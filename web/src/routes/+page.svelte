<script lang="ts">
  import EventCard from '$lib/components/EventCard.svelte';
  import { official } from '$lib/content';
  import type { PageData } from './$types';
  export let data: PageData;
  $: latestIssue = data.newsletters[0];
</script>

<svelte:head><title>Terrace F. Club — Food is love</title></svelte:head>

<section class="hero">
  <div class="hero-content shell">
    <div class="hero-copy">
      <span class="eyebrow light">WELCOME TO THE MOTHER <span aria-hidden="true">✳</span> PRINCETON, NJ</span>
      <h1>There’s always<br /><em>room at the table.</em></h1>
      <p>Good food. Loud music. The kind of community that feels like coming home.</p>
      <div class="hero-actions"><a class="button button-coral" href="/events/">See what’s happening <span aria-hidden="true">↗</span></a><a class="hero-text-link" href="/about/">Get to know us <span aria-hidden="true">→</span></a></div>
      <div class="hero-scribble" aria-hidden="true">come as you are <span>↗</span></div>
    </div>
    <div class="hero-photo" role="img" aria-label="The Terrace Club clubhouse on Washington Road">
      <div class="photo-caption">THE HOUSE ON WASHINGTON ROAD <span aria-hidden="true">✦</span></div>
      <img class="hero-badge" src="/images/food-is-love.png" alt="Food is love, Terrace F. Club" width="168" height="168" />
    </div>
  </div>
  <div class="hero-wave" aria-hidden="true"></div>
</section>

<section class="intro shell section-pad">
  <div class="intro-kicker"><span class="sunburst" aria-hidden="true">✳</span><span>HELLO, TERRAN<br />OR FUTURE FRIEND.</span></div>
  <div><h2>Food is love.<br /><em>It really is that simple.</em></h2><p>Terrace is a non-selective Princeton eating club built around shared meals, live music, and a warm, accepting community. Whether you’re a current member, an alum, or someone getting to know the place, there’s a place for you in the story.</p><a class="text-link" href="/about/">More about the club <span aria-hidden="true">↗</span></a></div>
</section>

<section class="happenings section-pad" id="happenings">
  <div class="shell">
    <div class="section-heading row-heading"><div><span class="eyebrow">THE GOOD STUFF, TOGETHER</span><h2>What’s happening<br /><em>around the table</em></h2></div><a class="button button-outline" href="/events/">Explore events <span aria-hidden="true">↗</span></a></div>
    {#if data.preview}<div class="preview-banner"><strong>Calendar preview</strong><span>These are sample listings for the redesign, not scheduled events. <a href={official.events} target="_blank" rel="noopener noreferrer">Check Terrace’s official calendar <span class="sr-only">(opens in a new tab)</span> ↗</a></span></div>{/if}
    <div class="event-grid">{#each data.events as event (event.slug)}<EventCard {event} />{:else}<p>New gatherings will appear here when they are announced.</p>{/each}</div>
  </div>
</section>

<section class="story-band section-pad">
  <div class="shell story-grid">
    <div class="story-image"><img src="/images/clubhouse-snow.jpg" alt="Terrace Club’s snow covered clubhouse at dusk" loading="lazy" width="900" height="900" /><span class="image-label">A PLACE TO FIND YOUR PEOPLE</span></div>
    <div class="story-copy"><span class="eyebrow">A LITTLE DIFFERENT BY DESIGN</span><h2>All kinds of people.<br /><em>One big table.</em></h2><p>Every Terran is a Terran. It’s more than a saying: membership is non-selective, and the clubhouse brings people together through meals, creativity, and the music that has always filled its rooms.</p><div class="story-links"><a class="button button-dark" href="/about/">Our story <span aria-hidden="true">↗</span></a><a class="text-link" href="/shows-archive/">Explore the shows archive <span aria-hidden="true">→</span></a></div></div>
  </div>
</section>

<section class="newsletter-band section-pad">
  <div class="shell newsletter-grid">
    <div><span class="eyebrow">NOTES FROM THE MOTHER</span><h2>Stories worth<br /><em>passing around.</em></h2><p>Catch up with club news, alumni voices, and what’s been happening at Terrace.{#if latestIssue} The latest issue is ready to read.{/if}</p><a class="button button-cream" href="/newsletter/">Read the newsletter <span aria-hidden="true">↗</span></a></div>
    {#if latestIssue}<a class="newsletter-paper" href={latestIssue.url} target="_blank" rel="noopener noreferrer" aria-label={`Read ${latestIssue.title} PDF, opens in a new tab`}><span class="paper-top">TERRACE F. CLUB <span>{latestIssue.season.toUpperCase()} {latestIssue.year}</span></span><span class="paper-flower" aria-hidden="true">✳</span><strong>Mother’s<br /><em>Musings</em></strong><span class="paper-bottom">ALUMNI NEWSLETTER <span>READ ISSUE ↗</span></span></a>{/if}
  </div>
</section>

{#if data.initiatives.length}<section class="shell section-pad"><div class="section-heading row-heading"><div><span class="eyebrow">GOOD THINGS GROW HERE</span><h2>Care in<br /><em>action.</em></h2></div><a class="text-link" href="/initiatives/">Explore initiatives ↗</a></div><div class="event-grid">{#each data.initiatives.slice(0, 3) as initiative (initiative.slug)}<article><h3>{initiative.title}</h3><p>{initiative.summary}</p><a class="text-link" href={`/initiatives/#${initiative.slug}`}>Read more<span class="sr-only"> about {initiative.title}</span> ↗</a></article>{/each}</div></section>{/if}

<section class="support-band section-pad"><div class="shell support-grid"><div><span class="eyebrow light">KEEP THE LOVE GOING</span><h2>Help make more<br /><em>room at the table.</em></h2></div><div><p>Terrace is sustained by people who care about the place and the people in it. Support the club in a way that works for you.</p><a class="button button-coral" href="/donate/">Support Terrace <span aria-hidden="true">↗</span></a></div><div class="support-doodle" aria-hidden="true">✳</div></div></section>
