<script lang="ts">
  import type { PageData } from './$types';
  import { archiveIssues, archiveTopics, filterArchiveStories, issueBySlug, pdfPageUrl } from '$lib/archive/content';
  import '$lib/archive/archive.css';

  export let data: PageData;

  $: visibleStories = filterArchiveStories(data.topic, data.query);
  $: additionalIssues = data.newsletters.filter((issue) => !archiveIssues.some((curated) => curated.pdfUrl === issue.url));

  function topicHref(topic: string): string {
    const params = new URLSearchParams();
    if (topic !== 'all') params.set('topic', topic);
    if (data.query) params.set('q', data.query);
    const suffix = params.toString();
    return '/newsletter/' + (suffix ? '?' + suffix : '') + '#explore';
  }
</script>

<svelte:head>
  <title>The living archive · Terrace F. Club</title>
  <meta name="description" content="Browse Terrace F. Club alumni newsletters by issue and theme, with page references and links to original PDFs." />
</svelte:head>

<div class="archive-root">
  <section class="archive-hero" aria-labelledby="archive-title">
    <div class="shell archive-hero-grid">
      <div class="archive-hero-copy">
        <p class="archive-overline">TERRACE F. CLUB / THE NEWSLETTERS</p>
        <h1 id="archive-title">A club, <em>in the margins.</em></h1>
        <p class="archive-lede">Recipes passed around. Music in the solarium. Notes from the Mother. Wander through the pages that Terrans have shared across the years.</p>
        <a class="archive-action" href="#explore">Explore the stories <span aria-hidden="true">↘</span></a>
        <p class="archive-provenance">Four selected public issues · 102 original pages · PDFs preserved</p>
      </div>
      <div class="archive-cover-stack" aria-label="Four original Terrace newsletter covers">
        {#each archiveIssues as issue, index}
          <a class={'archive-cover archive-cover-' + (index + 1)} href={'/newsletter/' + issue.slug + '/'} aria-label={'Open ' + issue.label + ' issue'}>
            <img src={issue.cover} alt={issue.coverAlt} width="420" height="560" fetchpriority={index === 0 ? 'high' : undefined} />
          </a>
        {/each}
        <span class="archive-cover-note" aria-hidden="true">PULL UP A CHAIR ✳</span>
      </div>
    </div>
  </section>

  <section class="archive-issues shell" aria-labelledby="issues-title">
    <div class="archive-section-heading">
      <div><p class="archive-overline">01 / THE ISSUES</p><h2 id="issues-title">Pick a <em>season.</em></h2></div>
      <p>Each cover opens an issue guide. The complete PDF is always one click away.</p>
    </div>
    <div class="archive-timeline">
      {#each archiveIssues as issue}
        <article class={'archive-issue-card archive-' + issue.accent}>
          <a class="archive-issue-image" href={'/newsletter/' + issue.slug + '/'} aria-label={'Explore ' + issue.label}>
            <img src={issue.cover} alt={issue.coverAlt} width="320" height="430" loading="lazy" />
          </a>
          <div class="archive-issue-info">
            <span class="archive-issue-date">{issue.year} / {issue.season.toUpperCase()}</span>
            <h3><a href={'/newsletter/' + issue.slug + '/'}>{issue.label}</a></h3>
            <p>{issue.note}</p>
            <span class="archive-page-count">{issue.pageCount} pages</span>
            <a class="archive-inline-link" href={'/newsletter/' + issue.slug + '/'}>Enter issue <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="archive-explore" id="explore" aria-labelledby="explore-title">
    <div class="shell">
      <div class="archive-section-heading">
        <div><p class="archive-overline">02 / FOLLOW A THREAD</p><h2 id="explore-title">Find your <em>way in.</em></h2></div>
        <p>Browse selected pages across issues. Every story points back to the original.</p>
      </div>
      <form class="archive-search" action="/newsletter/#explore" method="get" role="search">
        <label for="archive-query">Search the selected stories</label>
        <div class="archive-search-line">
          <input id="archive-query" name="q" type="search" value={data.query} placeholder="Try pie, Solarium, officers…" maxlength="100" />
          {#if data.topic !== 'all'}<input type="hidden" name="topic" value={data.topic} />{/if}
          <button type="submit">Search <span aria-hidden="true">↗</span></button>
        </div>
      </form>
      <nav class="archive-topic-nav" aria-label="Browse archive topics">
        {#each archiveTopics as topic}
          <a href={topicHref(topic.id)} aria-current={data.topic === topic.id ? 'true' : undefined}>{topic.label}</a>
        {/each}
      </nav>
      <p class="archive-result-count" aria-live="polite">{visibleStories.length} {visibleStories.length === 1 ? 'page' : 'pages'} in this selection</p>
      {#if visibleStories.length}
        <div class="archive-story-grid">
          {#each visibleStories as story}
            {@const issue = issueBySlug(story.issueSlug)}
            {#if issue}
              <article class="archive-story-card">
                <a class="archive-story-image" href={'/newsletter/' + issue.slug + '/#' + story.slug} aria-label={'Read ' + story.title + ' in ' + issue.label}>
                  <img src={story.image} alt={story.imageAlt} width="520" height="680" loading="lazy" />
                </a>
                <div class="archive-story-content">
                  <span class="archive-story-meta">{issue.label} / {story.topic} / P. {story.page}{story.endPage ? '–' + story.endPage : ''}</span>
                  <h3><a href={'/newsletter/' + issue.slug + '/#' + story.slug}>{story.title}</a></h3>
                  <p>{story.note}</p>
                  <a class="archive-source-link" href={pdfPageUrl(issue, story.page)} target="_blank" rel="noopener noreferrer">Original page {story.page} <span aria-hidden="true">↗</span><span class="sr-only"> (PDF opens in a new tab)</span></a>
                </div>
              </article>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="archive-empty"><h3>No pages found for that search.</h3><p>Try another word or browse everything.</p><a href="/newsletter/#explore">Show all stories →</a></div>
      {/if}
    </div>
  </section>

  <section class="archive-publisher shell" aria-labelledby="publisher-title">
    <div><p class="archive-overline">03 / MORE FROM THE PUBLISHER</p><h2 id="publisher-title">The latest <em>dispatches.</em></h2><p>Published newsletter issues from Terrace. PDFs open in a new tab.</p></div>
    <div class="archive-publisher-list">
      {#each additionalIssues as issue}
        <a href={issue.url} target="_blank" rel="noopener noreferrer"><span>{issue.season} {issue.year}</span><strong>{issue.title}</strong><b>Read PDF ↗<span class="sr-only"> (opens in a new tab)</span></b></a>
      {:else}
        <p>New issues will appear here when they are published. The curated issues above remain available to explore.</p>
      {/each}
    </div>
  </section>
</div>
