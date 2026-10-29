<script lang="ts">
  import type { PageData } from './$types';
  import { archiveIssues, pdfPageUrl } from '$lib/archive/content';
  import '$lib/archive/archive.css';

  export let data: PageData;
  $: issueIndex = archiveIssues.findIndex((item) => item.slug === data.issue.slug);
  $: nextIssue = archiveIssues[(issueIndex + 1) % archiveIssues.length];
</script>

<svelte:head>
  <title>{data.issue.label} newsletter · Terrace F. Club</title>
  <meta name="description" content={"Explore selected pages from Terrace F. Club's " + data.issue.label + " newsletter, with a link to the original PDF."} />
</svelte:head>

<div class="archive-root archive-detail">
  <section class={'archive-detail-hero archive-' + data.issue.accent}>
    <div class="shell archive-detail-grid">
      <div class="archive-detail-copy">
        <a class="archive-back" href="/newsletter/">← All newsletters</a>
        <p class="archive-overline">THE LIVING ARCHIVE / {data.issue.year}</p>
        <h1>{data.issue.label}<br /><em>at Terrace.</em></h1>
        <p>{data.issue.note} Explore a few pages here, or read the {data.issue.pageCount}-page original from cover to cover.</p>
        <a class="archive-action" href={data.issue.pdfUrl} target="_blank" rel="noopener noreferrer">Read the complete PDF <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>
      </div>
      <figure class="archive-detail-cover"><img src={data.issue.cover} alt={data.issue.coverAlt} width="480" height="640" /><figcaption>Original cover · {data.issue.label}</figcaption></figure>
    </div>
  </section>

  <section class="archive-detail-stories shell" aria-labelledby="inside-title">
    <div class="archive-section-heading"><div><p class="archive-overline">FROM THE PAGES</p><h2 id="inside-title">Inside this <em>issue.</em></h2></div><p>These short notes are guides to the source pages. Read the original for the full story, recipe or photograph.</p></div>
    {#each data.stories as story, index}
      <article class:archive-detail-story-reverse={index % 2 === 1} class="archive-detail-story" id={story.slug}>
        <div class="archive-detail-page">
          <a href={pdfPageUrl(data.issue, story.page)} target="_blank" rel="noopener noreferrer" aria-label={'Open ' + story.title + ' in original PDF, page ' + story.page + ', new tab'}>
            <img src={story.image} alt={story.imageAlt} width="700" height="900" loading="lazy" />
          </a>
          {#if story.followingPage}
            <a class="archive-following-page" href={pdfPageUrl(data.issue, story.followingPage.page)} target="_blank" rel="noopener noreferrer" aria-label={'Open following page ' + story.followingPage.page + ' in original PDF, new tab'}>
              <img src={story.followingPage.image} alt={story.followingPage.alt} width="700" height="900" loading="lazy" />
            </a>
          {/if}
          <p>From {data.issue.label}, p. {story.page}{story.endPage ? '–' + story.endPage : ''} · <a href={pdfPageUrl(data.issue, story.page)} target="_blank" rel="noopener noreferrer">View source ↗<span class="sr-only"> (PDF opens in a new tab)</span></a></p>
        </div>
        <div class="archive-detail-text"><span class="archive-story-meta">{String(index + 1).padStart(2, '0')} / {story.topic}</span><h3>{story.title}</h3><p>{story.note}</p><a href={pdfPageUrl(data.issue, story.page)} target="_blank" rel="noopener noreferrer">Read the original page <span aria-hidden="true">↗</span><span class="sr-only"> (PDF opens in a new tab)</span></a></div>
      </article>
    {/each}
    <div class="archive-detail-end"><p>Keep wandering through the archive.</p><a href={'/newsletter/' + nextIssue.slug + '/'}>Next issue: {nextIssue.label} <span aria-hidden="true">↗</span></a><a href="/newsletter/#explore">Browse by topic <span aria-hidden="true">↗</span></a></div>
  </section>
</div>
