<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>
<svelte:head><title>My data · Terrace members</title></svelte:head>
<header class="member-hero"><p class="member-eyebrow">Yours to take, yours to remove.</p><h1>My data.</h1>
<p class="member-intro">Download a copy of what you have shared here, or ask for it to be erased. Both stay inside your signed-in session; nothing is emailed.</p></header>
{#if form?.error}<p class="member-error" role="alert">{form.error}</p>{/if}
<div class="member-split"><div class="member-stack">
  <article class="member-card"><h2>Export your data</h2>
    <p>A JSON file of your own profile, stories, groups, mentorship offer and the requests you sent or replies you gave. It never includes other members’ writing or your sign-in identifiers.</p>
    <form method="POST" action="/members/account/export"><button type="submit">Download my data</button></form></article>
  <article class="member-card"><h2>Erase my data</h2>
    <p>This deletes your profile, stories, mentorship offer and group memberships, and anonymises your name on groups you founded and on mentorship conversations. Your member access ends and cannot be restored. A Terrace operator separately disables your sign-in account.</p>
    {#if form?.confirmationCode}
      <form class="member-form" method="POST" action="?/confirmErasure" use:enhance>
        <input type="hidden" name="code" value={form.confirmationCode} />
        <p class="member-help">Step 2 of 2. This confirmation is valid for 15 minutes and works once.</p>
        <label>Type <strong>erase my data</strong> to confirm<input name="confirm" autocomplete="off" required /></label>
        <button type="submit">Erase everything now</button>
      </form>
    {:else}
      <form method="POST" action="?/requestErasure" use:enhance><p class="member-help">Step 1 of 2. Nothing is erased until you confirm on the next screen.</p><button class="member-quiet" type="submit">Start erasure</button></form>
    {/if}
  </article>
</div></div>
