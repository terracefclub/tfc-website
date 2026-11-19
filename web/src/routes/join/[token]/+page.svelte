<script lang="ts">
  import { enhance } from '$app/forms';
  import '$lib/interior.css';
  let { data, form } = $props();
  const state = $derived(form?.state ?? data.state);
  const label = $derived(data.state === 'ready' && data.role === 'alumni' ? 'alumni' : 'current member');
</script>
<svelte:head><title>Your invitation · Terrace F. Club</title><meta name="robots" content="noindex" /><meta name="referrer" content="no-referrer" /></svelte:head>
<section class="page-hero coral"><div class="shell"><span class="eyebrow">INVITATION</span><h1>Welcome<br /><em>to Terrace.</em></h1></div></section>
<section class="shell content-section"><div class="prose">
  {#if state === 'ready'}
    <h2>Accept your invitation{data.state === 'ready' && data.name ? `, ${data.name}` : ''}.</h2>
    <p>You were approved as a {label}. Accepting uses this one-time link up.</p>
    <form method="POST" use:enhance><button type="submit">Accept invitation</button></form>
  {:else if state === 'accepted'}
    <h2>Invitation accepted.</h2>
    <p>A Terrace operator now sets up your sign-in account and gives you your first password privately. Once you have it, <a href="/members/">sign in to the members area</a>. Until then, sign-in will show the approval screen.</p>
  {:else if state === 'unavailable'}
    <h2>Please try again shortly.</h2><p>We could not check this invitation right now. Your link has not been used up.</p>
  {:else}
    <h2>This link is not valid.</h2><p>It may have expired or already been used. <a href="/apply/">Request to join again</a> or <a href="/contact/">contact the club</a>.</p>
  {/if}
</div></section>
