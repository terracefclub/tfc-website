<script lang="ts">import { enhance } from '$app/forms'; let { data, form } = $props();</script>
<svelte:head><title>Groups · Terrace members</title></svelte:head>
<header class="member-hero"><p class="member-eyebrow">Find a corner. Start a conversation.</p><h1>Your kind of weird.</h1>
<p class="member-intro">A place for cooks, musicians, game nights, local alumni, or whatever brings you together. Every approved Terran can discover and join a group; its stories are visible to the people who join.</p></header>
{#if form?.error}<p class="member-error" role="alert">{form.error}</p>{/if}{#if form?.success}<p class="member-success" role="status">{form.success}</p>{/if}
<div class="member-split"><div class="member-stack">
{#if !data.groups.docs.length}<p class="member-empty">No groups yet. You could start the first one.</p>{/if}
{#each data.groups.docs as group}
  {@const membership = data.memberships.find((item) => item.group === group.id)}
  <article class="member-card"><h2>{group.name}</h2><p class="member-meta">Started by {group.ownerName}</p><p>{group.description}</p><div class="member-actions">
  {#if membership}<a class="member-button" href={`/members/stories/?group=${group.id}`}>Group stories</a>{#if group.owner !== data.member.id}<form action="?/leave" method="POST" use:enhance><input type="hidden" name="membership" value={membership.id} /><button class="member-quiet" type="submit">Leave group</button></form>{:else}<span class="member-stamp">Founder</span>{/if}
  {:else}<form action="?/join" method="POST" use:enhance><input type="hidden" name="group" value={group.id} /><button type="submit">Join group</button></form>{/if}
  </div>{#if group.owner === data.member.id}<details><summary>Edit your group</summary><form class="member-form" action="?/edit" method="POST" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}><input type="hidden" name="group" value={group.id} /><label>Group name<input name="name" value={group.name} maxlength="100" required /></label><label>Description<textarea name="description" maxlength="2000" required>{group.description}</textarea></label><button type="submit">Save group</button></form></details>{/if}</article>
{/each}
<nav class="member-pagination" aria-label="Group pages">{#if data.groups.hasPrevPage}<a href={`?page=${data.groups.page - 1}`}>← Previous</a>{/if}<span>Page {data.groups.page} of {Math.max(data.groups.totalPages, 1)}</span>{#if data.groups.hasNextPage}<a href={`?page=${data.groups.page + 1}`}>Next →</a>{/if}</nav>
</div><aside class="member-card member-aside"><h2>Start something.</h2><form class="member-form" action="?/create" method="POST" use:enhance><label>Group name<input name="name" maxlength="100" required /></label><label>What brings you together?<textarea name="description" maxlength="2000" required></textarea></label><p class="member-help">Group names and descriptions are visible to approved members. Founders stay in their groups.</p><button type="submit">Create a group</button></form></aside></div>
