<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();
</script>
<svelte:head><title>My profile · Terrace members</title></svelte:head>
<p class="member-eyebrow">Your little corner</p><h1>Make yourself at home.</h1>
<p class="member-intro">Tell other Terrans a bit about yourself. Your profile stays out of the directory until you choose to share it. It is never public on the website.</p>
{#if form?.error}<p class="member-error" role="alert">{form.error}</p>{/if}
{#if form?.success}<p class="member-success" role="status">{form.success}</p>{/if}
<form class="member-form member-card" method="POST" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}>
  <label>Name on your profile<input name="displayName" required maxlength="100" autocomplete="name" value={data.profile?.displayName ?? data.member.displayName} /></label>
  <label>Class year <span class="member-help">Optional</span><input name="classYear" type="number" min="1904" max="2200" step="1" value={data.profile?.classYear ?? ''} /></label>
  <label>A little about you<textarea name="bio" maxlength="2000" placeholder="What are you making, learning, listening to?">{data.profile?.bio ?? ''}</textarea></label>
  <label>Things you’re into<input name="interests" maxlength="300" value={data.profile?.interests ?? ''} /></label>
  <label class="member-check"><input type="checkbox" name="directoryVisible" checked={data.profile?.directoryVisible ?? false} /><span>Show this profile to approved current members and alumni.<span class="member-help"> You can turn this off at any time.</span></span></label>
  <div><button type="submit">Save my profile</button></div>
</form>
