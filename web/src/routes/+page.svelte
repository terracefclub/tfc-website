<script lang="ts">
  import '$lib/edges.css';
  import EventCard from '$lib/components/EventCard.svelte';
  import { official } from '$lib/content';
  import type { PageData } from './$types';
  export let data: PageData;
  $: latestIssue = data.newsletters[0];
</script>

<svelte:head><title>Terrace F. Club — Food, music, other dimensions</title></svelte:head>

<section class="house-world">
  <div class="shell world-grid">
    <div class="world-copy">
      <span class="world-kicker">TERRACE F. CLUB / PRINCETON, NJ</span>
      <h1>Something<br />in the <em>walls.</em></h1>
      <p>An eating club, a room full of music, and generations of people making the place their own.</p>
      <div class="world-actions"><a class="button acid-button" href="/events/">What’s on <span aria-hidden="true">↗</span></a><a class="world-link" href="/about/">Come on in <span aria-hidden="true">→</span></a></div>
      <span class="world-footnote">Non-selective. Entirely Terrace.</span>
    </div>
    <div class="world-collage">
      <figure class="mural-print"><img src="/culture/mural.jpg" alt="A Terrace mural covered in drips, loops, and layers of red, yellow, blue, and green paint" width="1024" height="563" fetchpriority="high" /><figcaption>PAINT ON PAINT ON PAINT / THE CLUBHOUSE WALLS</figcaption></figure>
      <figure class="house-print"><img src="/images/clubhouse.jpg" alt="Terrace’s Tudor-style clubhouse on Washington Road" width="900" height="600" /><figcaption>62 WASHINGTON ROAD</figcaption></figure>
      <img class="world-seal" src="/culture/club-badge.png" alt="Terrace F. Club emblem, established 1904" width="300" height="300" />
      <span class="margin-note" aria-hidden="true">same house.<br />different universe.</span>
    </div>
  </div>
  <div class="shell world-index"><span>FOOD · MUSIC · PEOPLE · WHATEVER COMES NEXT</span><a href="#happenings">Down the rabbit hole <span aria-hidden="true">↓</span></a></div>
</section>

<section class="happenings section-pad" id="happenings">
  <div class="shell">
    <div class="section-heading row-heading"><div><span class="eyebrow">AT THE CLUB & OUT IN THE WORLD</span><h2>Make a night<br /><em>of it.</em></h2></div><a class="button button-outline" href="/events/">The calendar <span aria-hidden="true">↗</span></a></div>
    {#if data.preview}<div class="preview-banner"><strong>Calendar preview</strong><span>These are sample listings for the redesign, not scheduled events. <a href={official.events} target="_blank" rel="noopener noreferrer">Check Terrace’s official calendar <span class="sr-only">(opens in a new tab)</span> ↗</a></span></div>{/if}
    <div class="event-grid">{#each data.events as event (event.slug)}<EventCard {event} />{:else}<p>New gatherings will appear here when they are announced.</p>{/each}</div>
  </div>
</section>

<section class="time-machine section-pad edge-top">
  <div class="shell">
    <div class="time-heading"><span class="archive-stamp">THE TERRACE ARCHIVE</span><span class="archive-note">Four issues. Plenty of side quests.</span></div>
    <div class="time-grid">
      <div class="time-copy"><h2>Turn back<br /><em>the weird.</em></h2><p>Step inside the newsletters. The artwork, the shows, the people, the recipes. Follow a year—or follow a thread and see where it takes you.</p><a class="button ink-button" href="/newsletter/">Enter the archive <span aria-hidden="true">↗</span></a>
        <div class="archive-threads" aria-label="Explore archive topics"><a href="/newsletter/?topic=food#explore">Food & recipes ↗</a><a href="/newsletter/?topic=music#explore">Music & shows ↗</a><a href="/newsletter/?topic=people#explore">People & officers ↗</a></div>
      </div>
      <div class="issue-collage"><a class="issue-print print-2024" href="/newsletter/summer-2024/"><img src="/archive/summer-2024-cover.webp" alt="Summer 2024 newsletter cover, painted with Terrace’s mural art" width="927" height="1200" loading="lazy" /><span>SUMMER ’24 ↗</span></a><a class="issue-print print-2023" href="/newsletter/fall-2023/"><img src="/archive/fall-2023-cover.webp" alt="Fall 2023 newsletter cover reading Welcome to Club Terrace against a dark blue brick wall" width="927" height="1200" loading="lazy" /><span>FALL ’23 ↗</span></a></div>
    </div>
    {#if latestIssue}<p class="latest-publication">Latest listed issue: <a href={latestIssue.url} target="_blank" rel="noopener noreferrer">{latestIssue.title} · original PDF <span class="sr-only">(opens in a new tab)</span> ↗</a></p>{/if}
  </div>
</section>

<section class="room-story section-pad edge-top">
  <div class="shell room-grid">
    <figure class="show-print"><img src="/culture/performance.webp" alt="A guitarist performs in the solarium among string lights, plants, and a painted winged figure" width="1440" height="1080" loading="lazy" /><figcaption>SOLARIUM SESSIONS · FALL 2023 <a href="/newsletter/?topic=music#explore">Follow the music ↗</a></figcaption></figure>
    <div class="room-copy"><span class="eyebrow">MORE THAN THE BUILDING</span><h2>Every Terran<br /><em>is a Terran.</em></h2><p>The meals, the music, the murals: people make this place. Terrace’s non-selective membership is part of its story, and so are the alumni who keep coming back.</p><a class="text-link" href="/about/">Get to know Terrace ↗</a><a class="text-link room-archive" href="/shows-archive/">Dig through the shows archive ↗</a></div>
  </div>
</section>

{#if data.initiatives.length}<section class="shell section-pad initiatives-home"><div class="section-heading row-heading"><div><span class="eyebrow">KEEP IT GOING</span><h2>A little care.<br /><em>A lasting difference.</em></h2></div><a class="text-link" href="/initiatives/">Club initiatives ↗</a></div><div class="event-grid">{#each data.initiatives.slice(0, 3) as initiative (initiative.slug)}<article><h3>{initiative.title}</h3><p>{initiative.summary}</p><a class="text-link" href={`/initiatives/#${initiative.slug}`}>Read more<span class="sr-only"> about {initiative.title}</span> ↗</a></article>{/each}</div></section>{/if}

<section class="keep-terrace section-pad edge-top"><div class="shell keep-grid"><img src="/images/food-is-love.png" alt="Food is love, Terrace F. Club" width="200" height="200" loading="lazy" /><div><span class="world-kicker">FOR THE NEXT GENERATION</span><h2>Keep Terrace<br /><em>Terrace.</em></h2><p>Support the people and the place that make all of this possible.</p><a class="button acid-button" href="/donate/">Give to Terrace <span aria-hidden="true">↗</span></a></div></div></section>

<style>
  .house-world { background: #231c2b; color: #faf5e9; overflow: hidden; }
  .world-grid { display: grid; grid-template-columns: .95fr 1.05fr; gap: 30px; min-height: 620px; }
  .world-copy { padding: 75px 0 60px; position: relative; z-index: 2; }
  .world-kicker { color: #d9ed72; font: 700 13px/1.5 'DM Sans Variable', sans-serif; letter-spacing: .12em; }
  h1 { font-size: clamp(66px, 7.6vw, 106px); line-height: .98; margin: 32px 0 28px; letter-spacing: -.065em; }
  h1 em { color: #d9ed72; }
  .world-copy p { max-width: 360px; font-size: 17px; color: #e5dfe7; }
  .world-actions { display: flex; flex-wrap: wrap; gap: 28px; align-items: center; margin: 30px 0; }
  .acid-button { color: #231c2b; background: #d9ed72; border-radius: 0; box-shadow: 4px 4px 0 #827693; }
  .acid-button:hover { background: #e8f4a6; }
  .world-link { text-decoration: underline; text-underline-offset: 5px; font-size: 16px; font-weight: 700; }
  .world-footnote { font-size: 14px; letter-spacing: .04em; color: #cbc0d3; }
  figure { margin: 0; }
  .world-collage { position: relative; min-height: 600px; }
  .mural-print { position: absolute; top: 44px; right: -60px; width: 105%; transform: rotate(4deg); border: 10px solid #d3b8e4; background: #d3b8e4; }
  .mural-print img { width: 100%; height: auto; }
  .mural-print figcaption { position: absolute; left: 10px; top: 14px; max-width: 90%; padding: 8px 10px; font: 700 12px/1.4 monospace; color: #231c2b; background: #faf5e9; }
  .house-print { position: absolute; width: 52%; left: -14px; bottom: 35px; background: #faf5e9; padding: 9px 9px 0; color: #231c2b; transform: rotate(-7deg); box-shadow: 3px 8px 25px #0006; }
  .house-print img { width: 100%; height: auto; }
  .house-print figcaption { padding: 12px 3px; font: 700 12px/1.3 monospace; letter-spacing: .05em; }
  .world-seal { position: absolute; width: 122px; height: 122px; right: -10px; top: 365px; transform: rotate(13deg); border-radius: 50%; box-shadow: 4px 4px 0 #d9ed72; }
  .margin-note { position: absolute; bottom: 45px; right: 15px; color: #d3b8e4; font: italic 26px/1.1 'Fraunces Variable', serif; transform: rotate(4deg); }
  .world-index { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding-block: 24px; border-top: 1px solid #665670; font-size: 12px; font-weight: 700; letter-spacing: .1em; }
  .world-index a { color: #d9ed72; font-size: 14px; letter-spacing: 0; padding: 8px 0; }
  h2 { font: 400 clamp(46px, 6vw, 84px)/1 'Anton', Impact, sans-serif; letter-spacing: -.01em; text-transform: uppercase; }
  h2 em { font-style: normal; }
  .happenings { background: #f4eedf; }
  .time-machine { position: relative; --edge: #f4eedf; background: #d2b8e5; color: #231c2b; overflow: hidden; }
  .time-heading { display: flex; justify-content: space-between; gap: 20px; padding-bottom: 28px; border-bottom: 1px solid #65536f; }
  .archive-stamp { font: 800 13px/1.5 monospace; letter-spacing: .14em; }
  .archive-note { font: italic 20px/1.3 'Fraunces Variable', serif; }
  .time-grid { display: grid; grid-template-columns: .9fr 1.1fr; gap: 70px; align-items: center; padding-top: 45px; }
  .time-copy h2 { margin-bottom: 27px; }
  .time-copy p { max-width: 400px; }
  .ink-button { color: #faf5e9; background: #231c2b; border-radius: 0; }
  .ink-button:hover { background: #43344f; }
  .archive-threads { display: flex; flex-wrap: wrap; gap: 14px 20px; margin-top: 30px; font-size: 15px; font-weight: 700; }
  .archive-threads a { border-bottom: 1px solid; padding-bottom: 3px; }
  .issue-collage { min-height: 480px; position: relative; }
  .issue-print { display: block; position: absolute; width: 57%; padding: 8px; background: #faf5e9; box-shadow: 3px 6px 0 #231c2b; transition: transform .2s; }
  .issue-print img { aspect-ratio: 600/776; width: 100%; height: auto; object-fit: cover; }
  .issue-print span { display: block; padding: 10px 2px 2px; font: 700 13px/1.4 monospace; }
  .print-2024 { top: 0; left: 0; transform: rotate(-9deg); }
  .print-2023 { right: -5px; top: 75px; transform: rotate(7deg); }
  .issue-print:hover { transform: rotate(0); z-index: 2; }
  .latest-publication { margin: 40px 0 0; padding-top: 23px; border-top: 1px solid #65536f; font-size: 15px; }
  .latest-publication a { text-decoration: underline; text-underline-offset: 4px; }
  .room-story { position: relative; --edge: #d2b8e5; background: #faf5e9; }
  .room-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 80px; align-items: center; }
  .show-print { background: #231c2b; color: #faf5e9; padding: 12px; transform: rotate(-2deg); }
  .show-print img { aspect-ratio: 10/7; width: 100%; height: auto; object-fit: cover; }
  .show-print figcaption { padding-top: 14px; display: flex; justify-content: space-between; gap: 12px; font: 13px/1.5 monospace; }
  .show-print a { text-decoration: underline; }
  .room-copy h2 { margin: 20px 0 25px; }
  .room-copy p { max-width: 430px; }
  .room-archive { display: table; margin-top: 22px; }
  .initiatives-home { border-top: 1px solid #bfb29b; }
  .initiatives-home h3 { font-size: 29px; }
  .keep-terrace { position: relative; --edge: #faf5e9; background: #231c2b; color: #faf5e9; }
  .keep-grid { display: grid; grid-template-columns: .7fr 1fr; align-items: center; gap: 80px; }
  .keep-grid > img { width: min(280px, 100%); height: auto; justify-self: center; transform: rotate(-12deg); }
  .keep-grid h2 { margin: 24px 0; }
  .keep-grid h2 em { color: #d9ed72; }
  .keep-grid p { color: #e5dfe7; }
  @media (max-width: 1000px) {
    .world-grid { gap: 10px; }
    .world-seal { right: 0; width: 100px; height: 100px; }
    .margin-note { right: 0; font-size: 20px; }
    .time-grid { gap: 35px; }
    .issue-collage { min-height: 395px; }
    .room-grid { gap: 40px; }
  }
  @media (max-width: 700px) {
    .world-grid { grid-template-columns: 1fr; }
    .world-copy { padding: 56px 0 0; }
    h1 { font-size: clamp(56px, 17vw, 90px); }
    .world-copy p { max-width: 420px; }
    .world-collage { min-height: 430px; margin-top: 10px; }
    .mural-print { width: 88%; right: -10px; top: 35px; }
    .house-print { width: 48%; bottom: 22px; left: 5px; }
    .world-seal { top: 250px; width: 88px; height: 88px; right: 0; }
    .margin-note { bottom: 25px; right: 6px; font-size: 18px; }
    .world-index { align-items: flex-start; font-size: 9px; }
    .world-index span { max-width: 170px; }
    .world-index a { white-space: nowrap; }
    .time-heading { flex-direction: column; gap: 8px; }
    .time-grid,.room-grid,.keep-grid { grid-template-columns: 1fr; }
    .time-grid { gap: 45px; }
    .issue-collage { min-height: 455px; max-width: 440px; width: 100%; margin-inline: auto; }
    .room-grid { gap: 50px; }
    .keep-grid { gap: 40px; }
    .keep-grid > img { width: 160px; justify-self: start; }
    .show-print { transform: none; }
  }
  @media (max-width: 400px) {
    .issue-collage { min-height: 360px; }
    .mural-print figcaption { font-size: 11px; }
    .margin-note { bottom: 0; max-width: 44%; font-size: 16px; }
  }
</style>
