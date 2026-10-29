<script lang="ts">
  import { official } from '$lib/content';
  import { terraceShop } from '$lib/merch';
  import type { PageData } from './$types';
  export let data: PageData;
  const filters = [{ value: 'all', label: 'The whole pile' }, { value: 'wear', label: 'Wear it' }, { value: 'stick', label: 'Stick it' }, { value: 'carry', label: 'Carry it' }];
</script>

<svelte:head>
  <title>The Terrace shop · Terrace F. Club</title>
  <meta name="description" content="Mushrooms, fairies, and food equals love. Explore Terrace’s own designs, with ordering and fulfillment through Redbubble." />
</svelte:head>

<section class="shop-hero">
  <div class="shell shop-intro">
    <div><p class="shop-overline">THE TERRACE SHOP / TAKE SOME HOME</p>
      <h1>Wear your<br /><em>weird.</em></h1>
      <p class="shop-lede">A little piece of the Mother. On your back, on your bag, on the laptop that’s seen some things.</p>
      <a class="shop-link" href="#designs">Rummage around <span aria-hidden="true">↘</span></a>
    </div>
    <div class="shop-collage" aria-label="A few Terrace designs">
      <figure class="shop-shirt"><img src="/merch/terrace-mushroom.jpg" width="600" height="600" alt="Black Terrace Mushroom T-shirt with a colorful illustrated mushroom" /><figcaption>A LITTLE FUNGUS AMONG US</figcaption></figure>
      <img class="shop-sticker" src="/merch/pixel-terrace.jpg" width="600" height="600" alt="Pixel Terrace sticker with a colorful collage of Terrace imagery" />
      <span class="shop-stamp" aria-hidden="true">FOOD<br />IS<br />LOVE</span>
    </div>
  </div>
</section>

<section class="shop-shelf shell" id="designs" aria-labelledby="designs-title">
  <div class="shop-heading"><div><p class="shop-overline">FROM TERRACE’S REDBUBBLE SHOP</p><h2 id="designs-title">Good things.<br /><em>Odd company.</em></h2></div>
    <p>Browse here. Choose your size, color, and current price on Redbubble, where checkout, production, delivery, and order support happen.</p>
  </div>
  <nav class="shop-filters" aria-label="Filter merchandise">
    {#each filters as filter}<a href={'/merchandise/?category=' + filter.value + '#designs'} aria-current={data.category === filter.value ? 'page' : undefined}>{filter.label}</a>{/each}
  </nav>
  <div class="shop-grid">
    {#each data.designs as design}
      <article class="shop-card">
        <a class="shop-product-image" href={design.url} target="_blank" rel="noopener noreferrer" aria-label={'See ' + design.title + ' on Redbubble (opens in a new tab)'}><img src={design.image} width="600" height="600" alt={design.title + ' — ' + design.kind + ' from Terrace’s Redbubble shop'} loading="lazy" /></a>
        <div class="shop-card-copy"><p class="shop-kind">{design.kind}</p><h3>{design.title}</h3><p>{design.note}</p><a class="shop-product-link" href={design.url} target="_blank" rel="noopener noreferrer">Choose on Redbubble <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></div>
      </article>
    {/each}
  </div>
  <div class="shop-more"><h2>There’s more<br /><em>in the pile.</em></h2><div><p>More designs. More things to put them on.</p><a class="button button-dark" href={terraceShop} target="_blank" rel="noopener noreferrer">Explore the whole shop ↗<span class="sr-only"> (opens in a new tab)</span></a></div></div>
  <details class="shop-orders"><summary>Orders, deliveries, and club merchandise</summary><p>These products are sold through Terrace’s Redbubble shop. Redbubble shows the available options, final price, shipping, and return terms before you buy. This page is a selection of designs, so availability may change.</p><p>For other club merchandise and local ordering information, visit the <a href={official.merchandise} target="_blank" rel="noopener noreferrer">existing merchandise page<span class="sr-only"> (opens in a new tab)</span></a>.</p></details>
</section>

<style>
  .shop-hero { overflow:hidden; background:#32224d; color:#fff7e9; }
  .shop-intro { display:grid; grid-template-columns:1fr 1fr; gap:65px; align-items:center; padding-block:85px 95px; }
  .shop-overline { font-size:11px; font-weight:800; letter-spacing:.13em; }
  .shop-hero .shop-overline { color:#e7dc85; }
  h1 { margin:24px 0; font-size:clamp(68px,10vw,128px); line-height:.9; letter-spacing:-.04em; }
  h1 em { color:#e7dc85; }
  .shop-lede { max-width:420px; font-size:19px; line-height:1.7; }
  .shop-link { display:inline-flex; gap:45px; margin-top:22px; font-size:13px; font-weight:800; padding-block:12px; border-bottom:2px solid #e7dc85; }
  .shop-collage { position:relative; padding:20px 24px 70px 0; }
  .shop-shirt { margin:0; background:#f6e7d1; color:#32224d; padding:12px; transform:rotate(5deg); box-shadow:16px 16px 0 #644d77; }
  .shop-shirt img { display:block; width:100%; height:auto; }
  figcaption { padding:15px 4px 5px; font-size:12px; font-weight:800; letter-spacing:.08em; }
  .shop-sticker { position:absolute; width:31%; height:auto; bottom:0; left:-24px; transform:rotate(-12deg); border:8px solid #fff7e9; box-shadow:6px 6px 0 #1b1228; }
  .shop-stamp { position:absolute; bottom:10px; right:5px; width:115px; height:115px; display:grid; place-content:center; text-align:center; background:#e7dc85; color:#32224d; border-radius:50%; font:900 23px/1.05 'Fraunces Variable',Georgia,serif; transform:rotate(12deg); }
  .shop-shelf { padding-block:75px; scroll-margin-top:25px; }
  .shop-heading { display:grid; grid-template-columns:1fr 1fr; gap:70px; align-items:end; }
  h2 { font-size:clamp(40px,5vw,65px); line-height:1.02; margin:15px 0 0; }
  h2 em { color:#733748; }
  .shop-heading > p { max-width:420px; font-size:15px; line-height:1.8; }
  .shop-filters { display:flex; flex-wrap:wrap; gap:10px; margin:36px 0 30px; }
  .shop-filters a { padding:12px 18px; border:1px solid #32224d; font-size:12px; font-weight:800; min-height:44px; }
  .shop-filters a[aria-current] { background:#32224d; color:#fff7e9; }
  .shop-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:32px 25px; }
  .shop-card { border:1px solid #32224d; background:#eee6f4; }
  .shop-card:nth-child(3n + 2) { background:#e6ecc9; }
  .shop-card:nth-child(3n) { background:#f3d3bd; }
  .shop-product-image { display:block; padding:15px; }
  .shop-product-image img { display:block; width:100%; height:auto; object-fit:contain; transition:transform .2s; }
  .shop-product-image:hover img { transform:rotate(-2deg); }
  .shop-card-copy { padding:8px 22px 26px; }
  .shop-kind { margin:0; font-size:10px; text-transform:uppercase; letter-spacing:.1em; font-weight:800; }
  h3 { margin:12px 0; font-size:30px; line-height:1.1; }
  .shop-card-copy > p:not(.shop-kind) { font-size:13px; line-height:1.6; }
  .shop-product-link { display:flex; justify-content:space-between; gap:12px; margin-top:22px; padding-top:14px; border-top:1px solid #32224d66; font-size:12px; font-weight:800; }
  .shop-more { display:flex; gap:35px; align-items:center; justify-content:space-between; padding:45px 0; margin-top:30px; border-bottom:2px solid #32224d; }
  .shop-more h2 { font-size:45px; }
  .shop-orders { max-width:780px; margin-top:30px; font-size:14px; line-height:1.8; }
  summary { cursor:pointer; padding-block:10px; font-weight:800; }
  .shop-orders a { text-decoration:underline; }
  @media(prefers-reduced-motion:reduce) { .shop-product-image img { transition:none; } }
  @media(max-width:900px) { .shop-intro { gap:35px; } .shop-stamp { width:90px; height:90px; font-size:19px; } .shop-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media(max-width:650px) { .shop-intro { grid-template-columns:1fr; padding-block:50px 65px; gap:40px; } .shop-collage { margin-left:20px; } .shop-heading { grid-template-columns:1fr; gap:15px; } .shop-grid { grid-template-columns:1fr; } .shop-more { flex-direction:column; align-items:start; } .shop-shelf { padding-block:45px; } }
</style>
