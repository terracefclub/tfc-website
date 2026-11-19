<script lang="ts">
  export let eyebrow: string;
  export let title: string;
  export let byline: string | undefined = undefined;
  export let published: { iso: string; label: string } | undefined = undefined;
</script>

<section class="page-hero yellow content-hero">
  <div class="shell">
    <span class="eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    {#if published || byline}
      <p class="meta">{#if published}<time datetime={published.iso}>{published.label}</time>{/if}{#if published && byline}{' · '}{/if}{#if byline}By {byline}{/if}</p>
    {/if}
  </div>
</section>

<style>
  .content-hero { padding-block: 56px 60px; }
  .content-hero h1 { max-width: 920px; font-size: clamp(40px, 6.4vw, 84px); line-height: 1; overflow-wrap: anywhere; }
  .meta { font-size: 15px; font-weight: 700; letter-spacing: .02em; }
  @media (max-width: 700px) { .content-hero { padding-block: 44px; } }
</style>
