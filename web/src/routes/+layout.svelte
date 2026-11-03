<script lang="ts">
  import '../app.css';
  import type { LayoutData } from './$types';
  export let data: LayoutData;
  let menuOpen = false;
  let menuButton: HTMLButtonElement;
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && menuOpen) {
      menuOpen = false;
      menuButton?.focus();
    }
  }
  const links = [
    { href: '/events/', label: 'Events' },
    { href: '/newsletter/', label: 'Newsletter' },
    { href: '/initiatives/', label: 'Initiatives' },
    { href: '/about/', label: 'About' },
    { href: '/merchandise/', label: 'Shop' },
    { href: '/members/', label: 'Members' }
  ];
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>Terrace F. Club — Food is love</title>
  <meta name="description" content="Terrace F. Club: food, live music, art, and a community of current members and alumni at 62 Washington Road." />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>
<div class="topline">
  <span>62 WASHINGTON ROAD · PRINCETON, NJ</span>
  {#if data.editorSignIn}<a href={data.editorSignIn} rel="external noreferrer" style="font-size: .8rem; line-height: 24px; text-decoration: underline">Editor sign-in</a>
  {:else}<span>EVERY TERRAN IS A TERRAN</span>{/if}
</div>
<header class="site-header">
  <div class="header-inner shell">
    <a class="brand" href="/" aria-label="Terrace F. Club home" onclick={() => menuOpen = false}>
      <img class="brand-emblem" src="/culture/club-badge.png" alt="" width="44" height="44" />
      <span class="brand-name">TERRACE <small>F. CLUB</small></span>
    </a>
    <button bind:this={menuButton} class="menu-toggle" type="button" aria-controls="primary-nav" aria-expanded={menuOpen} onclick={() => menuOpen = !menuOpen}>
      <span>{menuOpen ? 'Close' : 'Menu'}</span><span class="menu-icon" aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
    </button>
    <nav class:open={menuOpen} id="primary-nav" aria-label="Primary navigation">
      {#each links as link}<a href={link.href} onclick={() => menuOpen = false}>{link.label}</a>{/each}
      <a class="nav-donate" href="/donate/" onclick={() => menuOpen = false}>Support Terrace <span aria-hidden="true">↗</span></a>
    </nav>
  </div>
</header>

<main id="main"><slot /></main>

<footer class="site-footer">
  <div class="shell footer-grid">
    <div>
      <div class="footer-brand">TERRACE <span>F. CLUB</span></div>
      <p>An eating club. A music venue. A place that stays with you.<br />62 Washington Road, Princeton.</p>
      <div class="footer-motto">FOOD = LOVE</div>
    </div>
    <div>
      <h2>Find your way</h2>
      <a href="/events/">Events</a><a href="/newsletter/">Newsletter</a><a href="/initiatives/">Initiatives</a><a href="/about/">Our story</a><a href="/shows-archive/">Shows archive</a>
    </div>
    <div>
      <h2>Stay close</h2>
      <a href="/members/">Member community</a><a href="/donate/">Give to Terrace</a><a href="/merchandise/">Merchandise</a><a href="/contact/">Contact</a>
      <a href="mailto:info@princetonterraceclub.org">info@princetonterraceclub.org</a>
    </div>
  </div>
  <div class="shell footer-bottom"><span>© {new Date().getFullYear()} Princeton Terrace Club</span><span>Every Terran is a Terran.</span></div>
</footer>
