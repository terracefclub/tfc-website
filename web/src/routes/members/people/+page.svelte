<script lang="ts">let { data } = $props();</script>
<svelte:head><title>People · Terrace members</title></svelte:head>
<header class="member-hero"><p class="member-eyebrow">A few familiar faces. A few new ones.</p><h1>Terrans, everywhere.</h1>
<p class="member-intro">Current members and alumni who have chosen to share a profile. No contact details are requested. Share only what you want other approved Terrans to see.</p></header>
{#if !data.profiles.docs.length}<p class="member-empty">It’s quiet here so far. <a href="/members/profile/">Share your profile</a> to help other Terrans find you.</p>{/if}
<div class="member-grid">{#each data.profiles.docs as profile}<article class="member-card"><h2>{profile.displayName}</h2>{#if profile.classYear}<p class="member-meta">Class of {profile.classYear}</p>{/if}{#if profile.bio}<p>{profile.bio}</p>{/if}{#if profile.interests}<p><strong>Into:</strong> {profile.interests}</p>{/if}</article>{/each}</div>
<nav class="member-pagination" aria-label="Directory pages">{#if data.profiles.hasPrevPage}<a href={`?page=${data.profiles.page - 1}`}>← Previous</a>{/if}<span>Page {data.profiles.page} of {Math.max(data.profiles.totalPages, 1)}</span>{#if data.profiles.hasNextPage}<a href={`?page=${data.profiles.page + 1}`}>Next →</a>{/if}</nav>
