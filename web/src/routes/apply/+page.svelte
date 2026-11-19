<script lang="ts">
  import { enhance } from '$app/forms';
  import '$lib/interior.css';
  let { data, form } = $props();
</script>
<svelte:head><title>Request to join · Terrace F. Club</title><meta name="robots" content="noindex" /></svelte:head>
<section class="page-hero coral"><div class="shell"><span class="eyebrow">JOIN THE COMMUNITY</span><h1>Ask to<br /><em>come in.</em></h1><p>The member community is for current members and alumni. Every account is approved by a person at the club.</p></div></section>
<section class="shell content-section"><div class="prose">
  {#if form?.received}
    <h2>Thank you.</h2><p>Your request was received. A person at the club will review it. No automatic email is sent; if it is approved you will get an invitation.</p>
  {:else if !data.open}
    <h2>Not open yet.</h2><p>Membership requests are not being accepted right now. Please check back soon or <a href="/contact/">contact the club</a>.</p>
  {:else}
    {#if form?.error}<p role="alert"><strong>{form.error}</strong></p>{/if}
    <form method="POST" use:enhance autocomplete="off">
      <input type="hidden" name="t" value={data.token} />
      <p><label>Your name<br /><input name="name" maxlength="120" required autocomplete="name" /></label></p>
      <p><label>You are a<br /><select name="affiliation" required><option value="">Choose one</option><option value="current-member">Current member</option><option value="alumni">Alumnus or alumna</option></select></label></p>
      <p><label>Class year (optional)<br /><input name="classYear" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" /></label></p>
      <p><label>Contact email<br /><input name="contactEmail" type="email" maxlength="254" required autocomplete="email" /></label></p>
      <p><label>Anything the club should know (optional)<br /><textarea name="note" maxlength="1000" rows="4"></textarea></label></p>
      <p class="hp" aria-hidden="true"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off" /></label></p>
      <p>We keep only these fields. Nothing is sent to anyone else.</p>
      <button type="submit">Send my request</button>
    </form>
  {/if}
</div></section>
<style>.hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }</style>
