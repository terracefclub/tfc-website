<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount, tick } from 'svelte';
  import '$lib/interior.css';
  import '$lib/intake.css';
  let { form } = $props();
  let token = $state('');
  let fromLink = $state(false);
  let alertBox: HTMLElement | undefined = $state();
  // A link that was just refused shows the paste field instead, so a typo can be fixed.
  const showPaste = $derived(!fromLink || form?.state === 'invalid');
  const invalid = $derived(form?.state === 'invalid');
  onMount(() => {
    let value = '';
    try { value = decodeURIComponent(location.hash.slice(1)); } catch { value = ''; }
    if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
      token = value;
      fromLink = true;
      history.replaceState(null, '', location.pathname);
    }
    if (form?.state) alertBox?.focus();
  });
</script>
<svelte:head>
  <title>Your invitation · Terrace F. Club</title>
  <meta name="description" content="Accept your invitation to the Terrace member community." />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="referrer" content="no-referrer" />
</svelte:head>
<section class="page-hero coral"><div class="shell"><span class="eyebrow">INVITATION</span><h1>Welcome<br /><em>to Terrace.</em></h1><p>One step to accept the invitation the club sent you.</p></div></section>
<section class="shell intake">
  {#if form?.state === 'accepted'}
    <div class="intake-grid">
      <div class="intake-card intake-done" role="status">
        <span class="intake-mark">Accepted</span>
        <h2>Invitation accepted.</h2>
        <p>A Terrace operator now sets up your sign-in account and gives you your first password privately. Once you have it, <a href="/members/">sign in to the members area</a>. Until then, sign-in will show the approval screen.</p>
      </div>
      <aside class="intake-aside" aria-labelledby="join-next">
        <h2 id="join-next">What happens next</h2>
        <ol>
          <li>An operator creates your account.</li>
          <li>They send you your first password privately.</li>
          <li>You sign in to the members area.</li>
        </ol>
        <p>Waiting a while? <a href="/contact/">Contact the club</a>.</p>
      </aside>
    </div>
  {:else}
    <div class="intake-grid">
      <div class="intake-card">
        {#if form?.state === 'invalid'}
          <div class="intake-alert" role="alert" tabindex="-1" bind:this={alertBox} aria-labelledby="join-alert-title">
            <h2 id="join-alert-title">This link is not valid</h2>
            <p>It may have expired or already been used.</p>
            <p>If you have just accepted this invitation, you are done. You can <a href="/members/">continue to sign in</a>.</p>
            <p><a href="/apply/">Request to join again</a> or <a href="/contact/">contact the club</a>.</p>
          </div>
        {:else if form?.state === 'unavailable'}
          <div class="intake-alert" role="alert" tabindex="-1" bind:this={alertBox} aria-labelledby="join-alert-title">
            <h2 id="join-alert-title">Please try again shortly</h2>
            <p>Your link has not been used up.</p>
          </div>
        {/if}
        <h2 id="join-title">Accept your invitation.</h2>
        <p>Accepting uses this one-time link up.</p>
        <form class="intake-form" method="POST" aria-labelledby="join-title" use:enhance={() => async ({ update }) => { await update({ reset: false }); await tick(); alertBox?.focus(); }}>
          {#if !showPaste}<input type="hidden" name="token" value={token} />
          {:else}
            <div class="intake-field">
              <label for="join-token">Invitation code from your message</label>
              <input id="join-token" name="token" bind:value={token} autocomplete="off" autocapitalize="off" spellcheck="false" required aria-invalid={invalid ? 'true' : undefined} aria-describedby={invalid ? 'join-token-help join-token-error' : 'join-token-help'} />
              <p class="intake-help" id="join-token-help">The long code after the # in your invitation link. Copy and paste it exactly.</p>
              {#if invalid}<p class="intake-error" id="join-token-error">That code was not accepted. Check it and try again.</p>{/if}
            </div>
          {/if}
          <div class="intake-submit"><button class="button button-coral" type="submit">Accept invitation <span aria-hidden="true">↗</span></button></div>
        </form>
      </div>
      <aside class="intake-aside" aria-labelledby="join-aside">
        <h2 id="join-aside">What this does</h2>
        <ol>
          <li>Your invitation is used up once.</li>
          <li>An operator then sets up your sign-in privately.</li>
          <li>You sign in to the members area.</li>
        </ol>
        <p>Link not working? <a href="/contact/">Contact the club</a>.</p>
      </aside>
    </div>
  {/if}
</section>
