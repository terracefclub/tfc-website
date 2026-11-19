<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount, tick } from 'svelte';
  import '$lib/interior.css';
  import '$lib/intake.css';
  let { data, form } = $props();
  // Svelte parses `{4}` in a plain attribute string as an expression, so the pattern goes in as an expression.
  const classYearPattern = '[0-9]{4}';
  type Echo = { values?: Record<'name' | 'affiliation' | 'classYear' | 'contactEmail' | 'note', string>; fieldErrors?: Record<string, string> };
  const values = $derived((form as Echo | null)?.values);
  const fieldErrors = $derived((form as Echo | null)?.fieldErrors ?? {});
  const order = ['name', 'affiliation', 'classYear', 'contactEmail', 'note'];
  const listed = $derived(order.filter((id) => fieldErrors[id]).map((id) => ({ id, message: fieldErrors[id] })));
  let alertBox: HTMLElement | undefined = $state();
  const describe = (id: string, help = '') => [help, fieldErrors[id] ? `apply-${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  onMount(() => { if (form?.error) alertBox?.focus(); });
</script>
<svelte:head>
  <title>Request to join · Terrace F. Club</title>
  <meta name="description" content="Current members and alumni can ask to join the Terrace member community. A person at the club reviews every request." />
  <meta name="robots" content="noindex" />
</svelte:head>
<section class="page-hero coral"><div class="shell"><span class="eyebrow">JOIN THE COMMUNITY</span><h1>Ask to<br /><em>come in.</em></h1><p>The member community is for current members and alumni. Every account is approved by a person at the club.</p></div></section>
<section class="shell intake">
  {#if form?.received}
    <div class="intake-card intake-done" role="status">
      <span class="intake-mark">Received</span>
      <h2>Thank you.</h2>
      <p>Your request was received. A person at the club will review it.</p>
      <p>No automatic email is sent. If your request is approved you will get an invitation by email, so there is nothing more to do for now.</p>
      <p><a href="/">Back to the home page</a></p>
    </div>
  {:else if !data.open}
    <div class="intake-card">
      <span class="intake-mark">Closed for now</span>
      <h2>Not open yet.</h2>
      <p>Membership requests are not being accepted right now. Please check back soon or <a href="/contact/">contact the club</a>.</p>
    </div>
  {:else}
    <div class="intake-grid">
      <div class="intake-card">
        <h2 id="apply-title">Tell us who you are.</h2>
        {#if form?.error}
          <div class="intake-alert" role="alert" tabindex="-1" bind:this={alertBox} aria-labelledby="apply-alert-title">
            <h2 id="apply-alert-title">There is a problem</h2>
            <p>{form.error}</p>
            {#if listed.length}<ul>{#each listed as item (item.id)}<li><a href={`#apply-${item.id}`}>{item.message}</a></li>{/each}</ul>{/if}
          </div>
        {/if}
        <form class="intake-form" method="POST" autocomplete="off" aria-labelledby="apply-title" use:enhance={() => async ({ update }) => { await update({ reset: false }); await tick(); alertBox?.focus(); }}>
          <input type="hidden" name="t" value={data.token} />
          <div class="intake-field">
            <label for="apply-name">Your name</label>
            <input id="apply-name" name="name" maxlength="120" required autocomplete="name" value={values?.name ?? ''} aria-invalid={fieldErrors.name ? 'true' : undefined} aria-describedby={describe('name')} />
            {#if fieldErrors.name}<p class="intake-error" id="apply-name-error">{fieldErrors.name}</p>{/if}
          </div>
          <div class="intake-field">
            <label for="apply-affiliation">You are a</label>
            <select id="apply-affiliation" name="affiliation" required aria-invalid={fieldErrors.affiliation ? 'true' : undefined} aria-describedby={describe('affiliation')}>
              <option value="">Choose one</option>
              <option value="current-member" selected={values?.affiliation === 'current-member'}>Current member</option>
              <option value="alumni" selected={values?.affiliation === 'alumni'}>Alumnus or alumna</option>
            </select>
            {#if fieldErrors.affiliation}<p class="intake-error" id="apply-affiliation-error">{fieldErrors.affiliation}</p>{/if}
          </div>
          <div class="intake-field">
            <label for="apply-classYear">Class year <span class="intake-optional">(optional)</span></label>
            <input id="apply-classYear" name="classYear" inputmode="numeric" pattern={classYearPattern} maxlength="4" title="Four digits, for example 2004" value={values?.classYear ?? ''} aria-invalid={fieldErrors.classYear ? 'true' : undefined} aria-describedby={describe('classYear', 'apply-classYear-help')} />
            <p class="intake-help" id="apply-classYear-help">Four digits, for example 2004.</p>
            {#if fieldErrors.classYear}<p class="intake-error" id="apply-classYear-error">{fieldErrors.classYear}</p>{/if}
          </div>
          <div class="intake-field">
            <label for="apply-contactEmail">Contact email</label>
            <input id="apply-contactEmail" name="contactEmail" type="email" maxlength="254" required autocomplete="email" value={values?.contactEmail ?? ''} aria-invalid={fieldErrors.contactEmail ? 'true' : undefined} aria-describedby={describe('contactEmail')} />
            {#if fieldErrors.contactEmail}<p class="intake-error" id="apply-contactEmail-error">{fieldErrors.contactEmail}</p>{/if}
          </div>
          <div class="intake-field">
            <label for="apply-note">Anything the club should know <span class="intake-optional">(optional)</span></label>
            <textarea id="apply-note" name="note" maxlength="1000" rows="5" aria-invalid={fieldErrors.note ? 'true' : undefined} aria-describedby={describe('note')}>{values?.note ?? ''}</textarea>
            {#if fieldErrors.note}<p class="intake-error" id="apply-note-error">{fieldErrors.note}</p>{/if}
          </div>
          <p class="hp" aria-hidden="true"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off" /></label></p>
          <p class="intake-note">We keep only these fields. Nothing is sent to anyone else.</p>
          <div class="intake-submit"><button class="button button-coral" type="submit">Send my request <span aria-hidden="true">↗</span></button></div>
        </form>
      </div>
      <aside class="intake-aside" aria-labelledby="apply-next">
        <h2 id="apply-next">What happens next</h2>
        <ol>
          <li>A person at the club reads your request.</li>
          <li>If it is approved, an invitation reaches the email address you gave.</li>
          <li>The invitation link lets you accept once, then sign in to the members area.</li>
        </ol>
        <p>Questions first? <a href="/contact/">Contact the club</a>.</p>
      </aside>
    </div>
  {/if}
</section>
<style>.hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }</style>
