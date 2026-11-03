<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();
</script>
<svelte:head><title>{data.group ? `${data.group.name} stories` : 'Stories'} · Terrace members</title></svelte:head>
<header class="member-hero"><p class="member-eyebrow">{data.group ? 'Around this corner' : 'Pass it around'}</p><h1>{data.group?.name ?? 'Remember that time?'}</h1>
<p class="member-intro">{data.group ? 'Stories shared with this group. You can leave the group from the Groups page.' : 'Small moments, big memories, recipes worth keeping. Share with the whole member community or just a group you’ve joined.'}</p></header>
{#if data.group}<p class="member-back"><a href="/members/stories/">← All stories you can read</a></p>{/if}
{#if form?.error}<p class="member-error" role="alert">{form.error}</p>{/if}{#if form?.success}<p class="member-success" role="status">{form.success}</p>{/if}
<div class="member-split"><div class="member-stack">
{#if !data.stories.docs.length}<p class="member-empty">The first story could be yours.</p>{/if}
{#each data.stories.docs as story}
  <article class="member-card"><span class="member-stamp">{story.audience === 'group' ? 'Group story' : 'Member community'}</span><h2>{story.title}</h2><p class="member-meta">{story.authorName} · <time datetime={story.createdAt}>{new Date(story.createdAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })}</time></p><p>{story.body}</p>
  {#if story.author === data.member.id}<details><summary>Edit your story</summary><form class="member-form" action="?/edit" method="POST" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}><input type="hidden" name="id" value={story.id} /><label>Title<input name="title" value={story.title} required maxlength="140" /></label><label>Story<textarea name="body" required maxlength="10000">{story.body}</textarea></label><label>Audience<select name="audience"><option value="community" selected={story.audience === 'community'}>All approved members and alumni</option><option value="group" selected={story.audience === 'group'}>A group I’ve joined</option></select></label><label>Group <span class="member-help">Used only for a group story</span><select name="group"><option value="">Choose a group</option>{#each data.groups as group}<option value={group.id} selected={story.group === group.id}>{group.name}</option>{/each}</select></label><button type="submit">Save changes</button></form><form action="?/remove" method="POST" use:enhance class="member-actions"><input type="hidden" name="id" value={story.id} /><button type="submit" class="member-quiet">Remove my story</button></form></details>{/if}
  {#if story.author !== data.member.id}
    <details><summary>Report this story</summary>
      <form class="member-form" action="?/report" method="POST" use:enhance>
        <input type="hidden" name="id" value={story.id} />
        <p>Terrace administrators will receive a copy of this story, its author’s name and your reason for reporting it. Other members won’t see the report. You can report each story once.</p>
        <label>Reason<select name="reason" required><option value="">Choose a reason</option><option value="privacy">Privacy concern</option><option value="harassment">Harassment</option><option value="other">Another concern</option></select></label>
        <button type="submit" class="member-quiet">Send report</button>
      </form>
    </details>
  {/if}
  </article>
{/each}
<nav class="member-pagination" aria-label="Story pages">{#if data.stories.hasPrevPage}<a href={`?page=${data.stories.page - 1}${data.group ? `&group=${data.group.id}` : ''}`}>← Previous</a>{/if}<span>Page {data.stories.page} of {Math.max(data.stories.totalPages, 1)}</span>{#if data.stories.hasNextPage}<a href={`?page=${data.stories.page + 1}${data.group ? `&group=${data.group.id}` : ''}`}>Next →</a>{/if}</nav>
</div><aside class="member-card member-aside"><h2>Got a story?</h2><form class="member-form" action="?/share" method="POST" use:enhance><label>Give it a title<input name="title" maxlength="140" required /></label><label>What happened?<textarea name="body" maxlength="10000" required></textarea></label><label>Who can read it?<select name="audience"><option value="community" selected={!data.group}>All approved members and alumni</option><option value="group" selected={Boolean(data.group)} disabled={!data.groups.length}>A group I’ve joined</option></select></label><label>Group <span class="member-help">Used only for a group story</span><select name="group"><option value="">Choose a group</option>{#each data.groups as group}<option value={group.id} selected={data.group?.id === group.id}>{group.name}</option>{/each}</select></label><p class="member-help">Ask before sharing someone else’s private details. Stories are plain text and stay inside the member community.</p><button type="submit">Share the story</button></form></aside></div>
