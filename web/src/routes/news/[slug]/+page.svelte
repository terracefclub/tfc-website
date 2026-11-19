<script lang="ts">
  import '$lib/interior.css';
  import ContentHero from '$lib/components/ContentHero.svelte';
  import RenderedBody from '$lib/components/RenderedBody.svelte';
  import { publishedDate } from '$lib/content';
  import type { PageData } from './$types';
  export let data: PageData;
  $: published = data.post.publishedAt ? { iso: data.post.publishedAt, label: publishedDate(data.post.publishedAt) } : undefined;
  $: description = data.post.seoDescription ?? data.post.excerpt;
</script>

<svelte:head>
  <title>{data.post.seoTitle ?? data.post.title} · Terrace F. Club</title>
  {#if description}<meta name="description" content={description} />{/if}
  <link rel="canonical" href={data.url} />
</svelte:head>

<ContentHero eyebrow="NEWS" title={data.post.title} {published} byline={data.post.authorName} />
<article class="shell content-section">
  <a class="back-link" href="/news/"><span aria-hidden="true">←</span> All news</a>
  <RenderedBody html={data.bodyHtml} />
  {#if data.previous || data.next}
    <nav class="adjacent" aria-label="More news">
      {#if data.previous}<a class="text-link" href={`/news/${data.previous.slug}/`} rel="prev"><span aria-hidden="true">←</span> Older: {data.previous.title}</a>{/if}
      {#if data.next}<a class="text-link" href={`/news/${data.next.slug}/`} rel="next">Newer: {data.next.title} <span aria-hidden="true">→</span></a>{/if}
    </nav>
  {/if}
</article>

<style>
  .adjacent { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 18px 30px; max-width: 760px; margin-top: 56px; padding-top: 28px; border-top: 2px solid #d7cbb3; }
  .adjacent a { max-width: 100%; }
</style>
