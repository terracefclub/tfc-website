<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import '$lib/interior.css';
  let { form } = $props();
  let token = $state('');
  let fromLink = $state(false);
  onMount(() => {
    const value = decodeURIComponent(location.hash.slice(1));
    if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
      token = value;
      fromLink = true;
      history.replaceState(null, '', location.pathname);
    }
  });
</script>
<svelte:head><title>Your invitation · Terrace F. Club</title><meta name="robots" content="noindex" /><meta name="referrer" content="no-referrer" /></svelte:head>
<section class="page-hero coral"><div class="shell"><span class="eyebrow">INVITATION</span><h1>Welcome<br /><em>to Terrace.</em></h1></div></section>
<section class="shell content-section"><div class="prose">
  {#if form?.state === 'accepted'}
    <h2>Invitation accepted.</h2>
    <p>A Terrace operator now sets up your sign-in account and gives you your first password privately. Once you have it, <a href="/members/">sign in to the members area</a>. Until then, sign-in will show the approval screen.</p>
  {:else}
    {#if form?.state === 'invalid'}<p role="alert"><strong>This link is not valid. It may have expired or already been used.</strong> <a href="/apply/">Request to join again</a> or <a href="/contact/">contact the club</a>.</p>{/if}
    {#if form?.state === 'unavailable'}<p role="alert"><strong>Please try again shortly.</strong> Your link has not been used up.</p>{/if}
    <h2>Accept your invitation.</h2>
    <p>Accepting uses this one-time link up.</p>
    <form method="POST" use:enhance>
      {#if fromLink}<input type="hidden" name="token" value={token} />
      {:else}<p><label>Paste the invitation code from your message<br /><input name="token" bind:value={token} autocomplete="off" spellcheck="false" required /></label></p>{/if}
      <button type="submit">Accept invitation</button>
    </form>
  {/if}
</div></section>
