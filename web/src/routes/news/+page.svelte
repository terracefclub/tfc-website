<script lang="ts">
  import '$lib/interior.css';
  import { publishedDate } from '$lib/content';
  import type { PageData } from './$types';
  export let data: PageData;
  const description = 'News and notes from Terrace F. Club.';
  $: canonical = data.origin + data.path + (data.page > 1 ? `?page=${data.page}` : '');
  $: href = (page: number) => page > 1 ? `/news/?page=${page}` : '/news/';
</script>

<svelte:head>
  <title>{data.page > 1 ? `News, page ${data.page}` : 'News'} · Terrace F. Club</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
</svelte:head>

<section class="page-hero yellow"><div class="shell"><span class="eyebrow">FROM THE CLUBHOUSE</span><h1>News &amp; <em>notes.</em></h1><p>What has been happening at Terrace.</p></div></section>
<section class="shell content-section">
  {#if data.docs.length}
    <ol class="news-list">
      {#each data.docs as post (post.slug)}
        <li>
          <article>
            <h2><a href={`/news/${post.slug}/`}>{post.title}</a></h2>
            {#if post.publishedAt}<p class="when"><time datetime={post.publishedAt}>{publishedDate(post.publishedAt)}</time></p>{/if}
            {#if post.excerpt}<p class="excerpt">{post.excerpt}</p>{/if}
          </article>
        </li>
      {/each}
    </ol>
    {#if data.totalPages > 1}
      <nav class="pager" aria-label="News pages">
        {#if data.page > 1}<a class="text-link" href={href(data.page - 1)} rel="prev"><span aria-hidden="true">←</span> Newer</a>{/if}
        <span>Page {data.page} of {data.totalPages}</span>
        {#if data.page < data.totalPages}<a class="text-link" href={href(data.page + 1)} rel="next">Older <span aria-hidden="true">→</span></a>{/if}
      </nav>
    {/if}
  {:else}
    <div class="prose"><h2>Nothing here yet.</h2><p>News will appear here when it is published. In the meantime, see <a href="/events/">what is on at Terrace</a> or <a href="/contact/">get in touch</a>.</p></div>
  {/if}
</section>

<style>
  .news-list { display: grid; gap: 14px; max-width: 880px; margin: 0; padding: 0; list-style: none; }
  article { padding: 22px 25px; background: #fff9e9; border-bottom: 2px solid #d7cbb3; }
  article:hover { background: #f8e6ca; }
  h2 { margin: 0 0 6px; font-size: clamp(26px, 3vw, 34px); line-height: 1.15; }
  h2 a:hover { text-decoration: underline; text-underline-offset: 4px; }
  h2 a:focus-visible { border-radius: 2px; }
  .when { margin: 0 0 8px; color: #ae4e3d; font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .excerpt { margin: 0; color: #455a4b; }
  .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; max-width: 880px; margin-top: 40px; font-size: 14px; font-weight: 800; }
</style>
