<script lang="ts">
  import { onMount } from 'svelte';
  import { pageAtReadingLine } from './reader-position';
  import type { ArchiveIssue, ArchiveStory } from './content';
  import type { NewsletterPage } from './reader';

  export let issue: ArchiveIssue;
  export let pages: NewsletterPage[];
  export let stories: ArchiveStory[];
  let currentPage = 1;
  let zoom = 1;
  let reader: HTMLElement;
  let controls: HTMLDivElement;
  let controlsHeight = 72;

  function goToPage(page: number) {
    const target = reader?.querySelector<HTMLElement>(`#page-${page}`);
    if (!target) return;
    currentPage = page;
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    target.focus({ preventScroll: true });
    history.replaceState(history.state, '', `#page-${page}`);
  }

  onMount(() => {
    const pageElements = Array.from(reader.querySelectorAll<HTMLElement>('[data-page]'));
    const controlSize = new ResizeObserver(() => { controlsHeight = controls.getBoundingClientRect().height; });
    controlSize.observe(controls);
    let pending: ReturnType<typeof setTimeout>;
    function updatePage() {
      const line = Math.max(0, controls.getBoundingClientRect().bottom) + 24;
      currentPage = pageAtReadingLine(pageElements.map((element) => ({
        page: Number(element.dataset.page), bottom: element.getBoundingClientRect().bottom
      })), line);
    }
    function scheduleUpdate() {
      clearTimeout(pending);
      pending = setTimeout(updatePage, 120);
    }
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();
    return () => {
      clearTimeout(pending);
      controlSize.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  });

</script>

<section class="newsletter-reader" id="read" aria-labelledby="reader-title" bind:this={reader} style:--reader-controls-height={controlsHeight + 'px'}>
  <div class="reader-heading shell">
    <p class="archive-overline">COVER TO COVER / {issue.pageCount} PAGES</p>
    <h2 id="reader-title">Stay a <em>little longer.</em></h2>
    <p>Every page, just as it was printed. Scroll through, jump around, or follow something that catches your eye.</p>
  </div>

  <div class="reader-controls" bind:this={controls}>
    <div class="reader-navigation" aria-label="Newsletter page controls">
      <button type="button" disabled={currentPage === 1} on:click={() => goToPage(currentPage - 1)} aria-label="Previous page">←</button>
      <label>Page <select aria-label="Go to newsletter page" value={currentPage} on:change={(event) => goToPage(Number(event.currentTarget.value))}>
        {#each pages as page}<option value={page.page}>{page.page}</option>{/each}
      </select> <span>of {issue.pageCount}</span></label>
      <button type="button" disabled={currentPage === issue.pageCount} on:click={() => goToPage(currentPage + 1)} aria-label="Next page">→</button>
    </div>
    <div class="reader-zoom" aria-label="Page size">
      <button type="button" disabled={zoom === 1} on:click={() => zoom = Math.max(1, zoom - .5)} aria-label="Zoom out">−</button>
      <output aria-live="polite">{zoom * 100}%</output>
      <button type="button" disabled={zoom === 2} on:click={() => zoom = Math.min(2, zoom + .5)} aria-label="Zoom in">+</button>
    </div>
    <a class="reader-pdf" href={issue.pdfUrl} target="_blank" rel="noopener noreferrer">Original PDF ↗<span class="sr-only"> (opens in a new tab)</span></a>
  </div>

  <div class="reader-desk">
    <aside class="reader-index" aria-label="Issue contents">
      <details>
        <summary>Find a page <span aria-hidden="true">↓</span></summary>
        <nav aria-label="All newsletter pages">
          {#each pages as page}<a href={'#page-' + page.page} aria-label={'Page ' + page.page}>{page.page}</a>{/each}
        </nav>
      </details>
      {#if stories.length}
        <div class="reader-bookmarks"><p>Dog-eared corners</p>
          {#each stories as story}<a href={'#page-' + story.page}><span>{String(story.page).padStart(2, '0')}</span>{story.title}</a>{/each}
        </div>
      {/if}
      <p class="reader-hint">Need larger type? Enlarge the page, or open its text underneath.</p>
    </aside>
    <div class="reader-pages">
      {#each pages as page}
        <article class="reader-page" id={'page-' + page.page} data-page={page.page} tabindex="-1" aria-label={issue.label + ', page ' + page.page}>
          <div class="reader-page-label"><span>{issue.label}</span><a href={'#page-' + page.page} aria-label={'Link to page ' + page.page}>PAGE {String(page.page).padStart(2, '0')} ↗</a></div>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (The enlarged page is a keyboard-scrollable region.) -->
          <div class="reader-image-scroll" tabindex={zoom > 1 ? 0 : undefined} role={zoom > 1 ? 'region' : undefined} aria-label={zoom > 1 ? 'Enlarged newsletter page; scroll sideways to read' : undefined}>
            <img src={page.src} srcset={`${page.smallSrc} ${page.smallWidth}w, ${page.src} ${page.width}w`} sizes={zoom > 1 ? '1800px' : '(max-width: 700px) 100vw, 900px'} width={page.width} height={page.height} style:width={zoom * 100 + '%'} alt={issue.label + ' newsletter, complete page ' + page.page + '. Read the page text below.'} loading="lazy" decoding="async" />
          </div>
          <details class="reader-page-text">
            <summary>Read page {page.page} text</summary>
            {#if page.text.trim()}<p class="reader-text-note">Text extracted from the original. Columns and spacing may read differently from the printed page.</p><div class="reader-transcript">{page.text}</div>
            {:else}<p>This page has no extractable text. Its original artwork is shown above.</p>{/if}
          </details>
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  .newsletter-reader { --reader-paper:#fffaf0; background:#d4ccb9; color:#292336; scroll-margin-top:20px; }
  .reader-heading { padding-block:70px 36px; }
  .reader-heading h2 { margin:0 0 18px; font-size:clamp(42px,6vw,76px); line-height:1.03; }
  .reader-heading h2 em { color:#733748; }
  .reader-heading > p:last-child { max-width:570px; }
  .reader-controls { position:sticky; top:0; z-index:8; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:12px 28px; min-height:72px; padding:12px 18px; background:#292336; color:#fffaf0; box-shadow:0 6px 18px #29233624; }
  .reader-navigation,.reader-zoom { display:flex; align-items:center; gap:10px; }
  .reader-navigation label { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; }
  button,select { border:1px solid #c6bacd; border-radius:0; min-height:42px; min-width:42px; background:#fffaf0; color:#292336; font:inherit; font-size:17px; font-weight:800; cursor:pointer; }
  button:hover:not(:disabled) { background:#e0ed93; }
  button:disabled { opacity:.4; cursor:default; }
  select { padding:7px; }
  output { min-width:43px; text-align:center; font-size:12px; font-weight:700; }
  .reader-pdf { font-size:12px; font-weight:800; text-decoration:underline; }
  .reader-desk { display:grid; grid-template-columns:200px minmax(0,900px); justify-content:center; align-items:start; gap:42px; padding:40px clamp(15px,4vw,60px) 90px; }
  .reader-index { position:sticky; top:100px; max-height:calc(100vh - 120px); overflow-y:auto; }
  .reader-index details { border-block:2px solid #292336; }
  summary { padding:16px 0; cursor:pointer; font-weight:800; font-size:13px; }
  .reader-index summary span { float:right; }
  .reader-index nav { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; padding-bottom:18px; }
  .reader-index nav a { display:grid; place-content:center; min-height:32px; background:#fffaf0; font-size:12px; font-weight:800; }
  .reader-index nav a:hover { background:#e0ed93; }
  .reader-bookmarks { padding-block:20px; }
  .reader-bookmarks > p { font:italic 700 23px 'Fraunces Variable',Georgia,serif; }
  .reader-bookmarks a { display:flex; gap:12px; margin-top:17px; font-size:12px; font-weight:700; line-height:1.5; }
  .reader-bookmarks a span { font-size:11px; color:#733748; }
  .reader-hint { font-size:12px; line-height:1.6; }
  .reader-pages { min-width:0; }
  .reader-page { margin-bottom:50px; scroll-margin-top:calc(var(--reader-controls-height,72px) + 24px); background:var(--reader-paper); box-shadow:9px 12px 0 #29233615,0 2px 10px #29233620; }
  .reader-page-label { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 20px; border-bottom:1px solid #29233624; font-size:11px; font-weight:800; letter-spacing:.06em; }
  .reader-image-scroll { overflow-x:auto; overscroll-behavior-x:contain; }
  .reader-image-scroll img { display:block; height:auto; max-width:none; }
  .reader-page-text { padding:0 20px; border-top:1px solid #29233624; }
  .reader-page-text summary { min-height:50px; }
  .reader-text-note { font-size:12px; color:#65586a; }
  .reader-transcript { padding-block:5px 25px; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.8; font-size:17px; }
  @media(max-width:900px) { .reader-desk { grid-template-columns:minmax(0,1fr); gap:20px; } .reader-index { position:static; max-height:none; } .reader-bookmarks,.reader-hint { display:none; } .reader-index nav { grid-template-columns:repeat(auto-fill,minmax(36px,1fr)); } }
  @media(max-width:500px) { .reader-controls { gap:10px; padding:10px; } .reader-pdf { width:100%; text-align:center; } .reader-desk { padding-inline:10px; } .reader-page-label { padding:12px; } .reader-heading { padding-top:50px; } }
</style>
