<script lang="ts">
  import { page } from '$app/state';
  import './members.css';
  let { data, children } = $props();
  const links = [['/members/', 'The living room'], ['/members/stories/', 'Stories'], ['/members/people/', 'People'], ['/members/groups/', 'Groups'], ['/members/mentorship/', 'Mentorship'], ['/members/profile/', 'My profile']];
</script>

<div class="members">
  <div class="member-top">
  <header class="member-banner">
    <div><p class="member-eyebrow">Terrans, among Terrans.</p><p class="member-welcome">Hey, {data.member.displayName}.</p></div>
    <form action="/auth/logout" method="POST"><button class="member-quiet" type="submit">Sign out</button></form>
  </header>
  <nav class="member-nav" aria-label="Member community">
    {#each links as [href, label]}<a {href} aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a>{/each}
  </nav>
  </div>
  <div class="member-body">{@render children()}</div>
  <p class="member-privacy">For approved current members and alumni. Keep other people’s stories here unless they say it’s okay to share.</p>
</div>
