<script lang="ts">
  import '$lib/interior.css';
  import '$lib/edges.css';
  import { official } from '$lib/content';
</script>
<svelte:head><title>Shows archive · Terrace F. Club</title><meta name="description" content="Explore Terrace Club's long history of live music and visit its official shows archive." /></svelte:head>

<section class="page-hero yellow">
  <div class="shell shows-hero">
    <div>
      <span class="eyebrow">TURN IT UP</span>
      <h1>The house<br /><em>has heard it all.</em></h1>
      <p>Music is part of the Terrace story. Take a look back through the official shows archive.</p>
    </div>
    <figure class="hero-print">
      <img src="/culture/performance.webp" alt="A guitarist performs in the solarium among string lights, plants, and a painted winged figure" width="1440" height="1080" fetchpriority="high" />
      <figcaption>Solarium Sessions · <a href="https://princetonterraceclub.org/wp-content/uploads/2023-Newsletter-2.pdf#page=19" target="_blank" rel="noopener noreferrer">Fall 2023 newsletter, page 19 <span aria-hidden="true">↗</span><span class="sr-only">(opens in a new tab)</span></a></figcaption>
    </figure>
  </div>
</section>
<span class="scribble wall-divider" aria-hidden="true"></span>

<section class="wall-section" aria-labelledby="wall-title">
  <div class="shell">
    <h2 id="wall-title">Music at the <em>Mother</em></h2>
    <p class="wall-intro">For decades the clubhouse has made room for live music and the people who love it. A few rooms and walls it has played in:</p>
    <div class="poster-wall">
      <figure class="flyer flyer-pool"><img src="/culture/pool-room.webp" alt="Friends playing pool in the painted pool room" width="1440" height="1080" loading="lazy" /><figcaption>The pool room, where the walls are the poster · <a href="https://princetonterraceclub.org/wp-content/uploads/2023-Newsletter-2.pdf#page=9" target="_blank" rel="noopener noreferrer">Fall 2023, page 9 <span aria-hidden="true">↗</span><span class="sr-only">(opens in a new tab)</span></a></figcaption></figure>
      <figure class="flyer flyer-mural"><img src="/culture/mural.jpg" alt="A Terrace mural covered in drips, loops, and layers of red, yellow, blue, and green paint" width="1024" height="563" loading="lazy" /><figcaption>Paint on paint on paint. Original creator and date not identified.</figcaption></figure>
      <figure class="flyer flyer-house"><img src="/images/clubhouse.jpg" alt="Terrace’s Tudor-style clubhouse on Washington Road" width="2048" height="1026" loading="lazy" /><figcaption>62 Washington Road, the Mother herself.</figcaption></figure>
    </div>
  </div>
</section>

<section class="shows-actions">
  <div class="shell">
    <span class="scribble scribble-thin" aria-hidden="true"></span>
    <div class="actions-row">
      <div><h2>Follow the music</h2><p>Read the shows as they were written up in the newsletters, or browse the official list.</p></div>
      <div class="actions-buttons"><a class="button button-dark" href="/newsletter/?topic=music#explore">Music in the newsletters <span aria-hidden="true">→</span></a><a class="button button-outline" href={official.shows} target="_blank" rel="noopener noreferrer">Official shows archive <span aria-hidden="true">↗</span><span class="sr-only">(opens in a new tab)</span></a></div>
    </div>
  </div>
</section>

<style>
  .shows-hero { display: grid; grid-template-columns: 1.05fr .95fr; gap: 60px; align-items: center; }
  .hero-print { margin: 0; padding: 12px; background: #fff7df; color: #33253a; transform: rotate(2deg); box-shadow: 12px 13px 0 #33253a; }
  .hero-print img, .flyer img { width: 100%; height: auto; }
  .hero-print figcaption, .flyer figcaption { padding: 12px 4px 4px; font-size: 13px; line-height: 1.5; }
  .hero-print a, .flyer a { text-decoration: underline; text-underline-offset: 3px; font-weight: 800; }
  .wall-divider { color: #33253a; margin-block: -8px 0; }
  .wall-section { padding-block: 70px 80px; background: #f3ecda; color: #33253a; overflow: clip; }
  .wall-section h2 { margin: 0 0 14px; font: 400 clamp(48px, 6.5vw, 92px)/1 'Anton', Impact, sans-serif; letter-spacing: -.01em; text-transform: uppercase; }
  .wall-section h2 em { color: #a3324f; font-style: normal; }
  .wall-intro { max-width: 620px; font-size: 18px; }
  .poster-wall { display: grid; grid-template-columns: repeat(12, 1fr); gap: 34px 28px; align-items: start; margin-top: 54px; }
  .flyer { margin: 0; padding: 12px; background: #fff7df; box-shadow: 8px 9px 0 #33253a; border: 1px solid #33253a; position: relative; }
  .flyer::before { content: ''; position: absolute; top: -14px; left: 50%; width: 92px; height: 28px; margin-left: -46px; background: rgba(229, 231, 133, .85); border: 1px solid rgba(51, 37, 58, .25); transform: rotate(-3deg); }
  .flyer-pool { grid-column: 1 / span 5; transform: rotate(-2deg); }
  .flyer-mural { grid-column: 6 / span 7; margin-top: 60px; transform: rotate(1.5deg); background: #efaab6; }
  .flyer-house { grid-column: 4 / span 6; transform: rotate(-1deg); background: #b7d6d8; }
  .shows-actions { padding-block: 0 90px; background: #f3ecda; color: #33253a; }
  .actions-row { display: flex; align-items: center; justify-content: space-between; gap: 40px; padding-top: 38px; }
  .actions-row h2 { margin: 0 0 8px; font: 400 clamp(36px, 4vw, 52px)/1 'Anton', Impact, sans-serif; text-transform: uppercase; }
  .actions-row p { margin: 0; max-width: 460px; font-size: 16px; }
  .actions-buttons { display: flex; flex-wrap: wrap; gap: 14px; }
  .button-dark { background: #33253a; }
  .button-outline { border-color: #33253a; color: #33253a; }
  .button-outline:hover { background: #33253a; color: #fff7df; }
  @media (max-width: 900px) {
    .shows-hero { grid-template-columns: 1fr; gap: 44px; }
    .actions-row { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 700px) {
    .poster-wall { grid-template-columns: 1fr; gap: 42px; }
    .flyer-pool, .flyer-mural, .flyer-house { grid-column: 1; margin-top: 0; }
    .hero-print { margin-inline: 6px; }
  }
</style>
