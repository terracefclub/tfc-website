<script lang="ts">
  import NewsletterReader from '$lib/archive/NewsletterReader.svelte';
  import type { PageData } from './$types';
  import { archiveIssues, pdfPageUrl } from '$lib/archive/content';
  import '$lib/archive/archive.css';

  export let data: PageData;
  $: issueIndex = archiveIssues.findIndex((item) => item.slug === data.issue.slug);
  $: nextIssue = archiveIssues[(issueIndex + 1) % archiveIssues.length];
</script>

<svelte:head>
  <title>{data.issue.label} newsletter · Terrace F. Club</title>
  <meta name="description" content={"Read every page of Terrace F. Club's " + data.issue.label + " newsletter, with its original artwork, page navigation and text."} />
</svelte:head>

<div class="archive-root archive-detail">
  <section class={'archive-detail-hero archive-' + data.issue.accent}>
    <div class="shell archive-detail-grid">
      <div class="archive-detail-copy">
        <a class="archive-back" href="/newsletter/">← All newsletters</a>
        <p class="archive-overline">THE LIVING ARCHIVE / {data.issue.year}</p>
        <h1>{data.issue.label}<br /><em>at Terrace.</em></h1>
        <p>{data.issue.note} All {data.issue.pageCount} pages are here. Come for one thing. Stay for everything else.</p>
        <a class="archive-action" href="#read">Open the issue <span aria-hidden="true">↓</span></a>
        <a class="archive-pdf-backup" href={data.issue.pdfUrl} target="_blank" rel="noopener noreferrer">Keep a PDF copy ↗<span class="sr-only"> (opens in a new tab)</span></a>
      </div>
      <figure class="archive-detail-cover"><img src={data.issue.cover} alt={data.issue.coverAlt} width="480" height="640" /><figcaption>Original cover · {data.issue.label}</figcaption></figure>
    </div>
  </section>

  <section class="issue-notes shell" aria-labelledby="inside-title">
    <div><p class="archive-overline">A FEW PLACES TO START</p><h2 id="inside-title">Follow a <em>loose thread.</em></h2></div>
    <div class="issue-notes-grid">
      {#each data.stories as story}
        <article id={story.slug}>
          <span class="archive-story-meta">{story.topic} / P. {story.page}{story.endPage ? '–' + story.endPage : ''}</span>
          <h3><a href={'#page-' + story.page}>{story.title} <span aria-hidden="true">↘</span></a></h3>
          <p>{story.note}</p>
          <a class="issue-source" href={pdfPageUrl(data.issue, story.page)} target="_blank" rel="noopener noreferrer">Original source ↗<span class="sr-only"> (PDF opens in a new tab)</span></a>
        </article>
      {/each}
    </div>
  </section>

  {#key data.issue.slug}<NewsletterReader issue={data.issue} pages={data.pages} stories={data.stories} />{/key}

  <div class="archive-detail-end shell"><p>Keep wandering through the archive.</p><a href={'/newsletter/' + nextIssue.slug + '/'}>Next issue: {nextIssue.label} <span aria-hidden="true">↗</span></a><a href="/newsletter/#explore">Browse by topic <span aria-hidden="true">↗</span></a></div>
</div>

<style>
  .archive-pdf-backup { display:block; width:fit-content; margin-top:18px; font-size:12px; text-decoration:underline; }
  .issue-notes { padding-block:55px; }
  .issue-notes h2 { margin:0 0 30px; font-size:clamp(38px,5vw,64px); }
  .issue-notes h2 em { color:#733748; }
  .issue-notes-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; }
  .issue-notes article { border-top:2px solid #292336; padding-top:18px; scroll-margin-top:20px; }
  .issue-notes h3 { margin:14px 0; font-size:28px; line-height:1.1; }
  .issue-notes article p { font-size:13px; line-height:1.6; }
  .issue-source { font-size:11px; text-decoration:underline; }
  .archive-detail-end { padding-block:45px 65px; }
  @media(max-width:700px) { .issue-notes-grid { grid-template-columns:1fr; } }
</style>
