<script lang="ts">
  import '../app.css';
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
    { href: '/about/', label: 'About' },
    { href: '/contact/', label: 'Contact' }
  ];
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>Terrace F. Club — Food is love</title>
  <meta name="description" content="Meet Terrace F. Club: a welcoming Princeton eating club with food, music, and a community that stays connected." />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>
<div class="topline"><span>62 WASHINGTON ROAD · PRINCETON, NJ</span><span>FOOD = LOVE <span aria-hidden="true">✳</span> EVERY TERRAN IS A TERRAN</span></div>
<header class="site-header">
  <div class="header-inner shell">
    <a class="brand" href="/" aria-label="Terrace F. Club home" onclick={() => menuOpen = false}>
      <span class="brand-mark" aria-hidden="true">✳</span>
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
      <div class="footer-brand">TERRACE <span>F. CLUB</span><i aria-hidden="true">✳</i></div>
      <p>Food, music, and a little bit of magic<br />at 62 Washington Road.</p>
      <div class="footer-motto">FOOD = LOVE</div>
    </div>
    <div>
      <h2>Find your way</h2>
      <a href="/events/">Events</a><a href="/newsletter/">Newsletter</a><a href="/about/">Our story</a><a href="/shows-archive/">Shows archive</a>
    </div>
    <div>
      <h2>Stay close</h2>
      <a href="/donate/">Give to Terrace</a><a href="/merchandise/">Merchandise</a><a href="/contact/">Contact</a>
      <a href="mailto:info@princetonterraceclub.org">info@princetonterraceclub.org</a>
    </div>
  </div>
  <div class="shell footer-bottom"><span>© {new Date().getFullYear()} Princeton Terrace Club</span><span>Made with love for Terrans everywhere <span aria-hidden="true">✳</span></span></div>
</footer>
