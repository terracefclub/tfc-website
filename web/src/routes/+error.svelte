<script lang="ts">import { page } from '$app/stores';</script>
<svelte:head><title>{$page.status === 404 ? 'Page not found' : 'Please try again'} · Terrace F. Club</title></svelte:head>
<section class="shell content-section prose">
  <h1>{$page.status === 404 ? 'We couldn’t find that page.' : 'We’re having trouble loading this.'}</h1>
  <p>{$page.status === 404 ? 'The link may have changed, or the content may no longer be published.' : 'Please try again shortly. You can still visit Terrace’s current website.'}</p>
  <a class="button button-dark" href="https://princetonterraceclub.org/">Visit Terrace’s current website ↗</a>
</section>
