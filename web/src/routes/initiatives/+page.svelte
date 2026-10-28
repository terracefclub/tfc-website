<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<svelte:head><title>Initiatives · Terrace F. Club</title><meta name="description" content="Discover the projects that support Terrace and its community." /></svelte:head>
<section class="page-hero yellow"><div class="shell"><span class="eyebrow">GOOD THINGS GROW HERE</span><h1>A little care.<br /><em>A lasting difference.</em></h1><p>The projects and people helping Terrace thrive.</p></div></section>
<section class="shell content-section prose">
  {#each data.initiatives as initiative (initiative.slug)}
    <article id={initiative.slug} class="initiative"><h2>{initiative.title}</h2><p>{initiative.summary}</p>
      {#if initiative.description !== initiative.summary}{#each initiative.description.split('\n\n') as paragraph}<p>{paragraph}</p>{/each}{/if}
      {#if initiative.ctaUrl}<a class="button button-dark" href={initiative.ctaUrl} target="_blank" rel="noopener noreferrer">{initiative.ctaLabel}<span class="sr-only"> (opens in a new tab)</span> ↗</a>{/if}
    </article>
  {:else}
    <h2>More to share soon.</h2><p>New initiatives will appear here when they are ready. In the meantime, you can <a href="/donate/">support Terrace</a> or <a href="/contact/">get in touch</a>.</p>
  {/each}
</section>

<style>.initiative + .initiative { margin-top: 4rem; }</style>
