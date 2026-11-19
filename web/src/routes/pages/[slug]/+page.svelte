<script lang="ts">
  import '$lib/interior.css';
  import ContentHero from '$lib/components/ContentHero.svelte';
  import RenderedBody from '$lib/components/RenderedBody.svelte';
  import type { PageData } from './$types';
  export let data: PageData;
  $: description = data.page.seoDescription ?? data.page.excerpt;
</script>

<svelte:head>
  <title>{data.page.seoTitle ?? data.page.title} · Terrace F. Club</title>
  {#if description}<meta name="description" content={description} />{/if}
  <link rel="canonical" href={data.url} />
</svelte:head>

<ContentHero eyebrow="TERRACE F. CLUB" title={data.page.title} />
<article class="shell content-section">
  <RenderedBody html={data.bodyHtml} />
</article>
