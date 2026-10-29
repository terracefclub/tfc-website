<script lang="ts">
  import { official } from '$lib/content';
  import { donationFunds } from '$lib/donations';
  import type { PageData } from './$types';
  export let data: PageData;
  const dollars = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);
</script>

<svelte:head>
  <title>Keep the good weird going · Terrace F. Club</title>
  <meta name="description" content="Support the meals, the music, the art, and the people who make Terrace." />
</svelte:head>

<section class="giving-hero">
  <div class="shell giving-grid">
    <div class="giving-intro">
      <span class="eyebrow light">PASS IT ON</span>
      <h1>Keep the<br /><em>good weird</em><br />going.</h1>
      <p>Another plate. Another song. Another person who walks in and thinks: <em>oh, these are my people.</em></p>
      <a class="button button-lime" href="#give">Put something in the pot <span aria-hidden="true">↘</span></a>
    </div>
    <figure class="giving-photo">
      <img src="/culture/performance.webp" alt="A guitarist playing among plants, string lights, and a painted winged figure in Terrace’s solarium" width="1440" height="1080" />
      <figcaption>Solarium Sessions / from the Fall 2023 newsletter</figcaption>
    </figure>
  </div>
</section>

<section class="shell giving-body" id="give" aria-labelledby="giving-title">
  <div class="giving-heading">
    <span class="eyebrow">A LITTLE LOVE, PASSED ALONG</span>
    <h2 id="giving-title">For whoever<br /><em>comes next.</em></h2>
    <p>Terrace is made by people. Giving is one way to keep making it.</p>
  </div>
  {#if data.mode === 'test'}
    <div class="test-notice" role="note"><strong>Test checkout · no real donations.</strong> These options open Stripe’s test environment.</div>
  {/if}
  {#if data.checkouts.length}
    <div class="giving-options">
      {#each data.checkouts as checkout}
        <article class="giving-option">
          <span class="eyebrow">{donationFunds[checkout.fund].label}</span>
          <h3>{donationFunds[checkout.fund].title}</h3>
          <p>{donationFunds[checkout.fund].description}</p>
          <p class="giving-amount">{checkout.frequency === 'monthly' ? `${dollars(checkout.monthlyAmountCents!)} USD / month` : 'Choose your amount'}</p>
          <p class="small-note">{checkout.frequency === 'monthly' ? 'A recurring monthly gift. Review the schedule and cancellation terms at checkout.' : 'A one-time gift. Choose and review your amount at checkout.'}</p>
          <a class="button button-coral" href={`/donate/checkout/?option=${checkout.id}`}>{data.mode === 'test' ? 'Try test checkout' : 'Continue to Stripe'} <span aria-hidden="true">↗</span></a>
          <p class="small-note">Recipient: {checkout.recipient}</p>
        </article>
      {/each}
    </div>
    <p class="giving-footnote">You’ll review your gift and enter payment details on Stripe. Your receipt and confirmation come from the payment provider.</p>
  {:else}
    <div class="giving-current">
      <img src="/images/food-is-love.png" alt="Food is love, Terrace F. Club" width="180" height="180" />
      <div><h3>Put your love where the food is.</h3><p>Choose your amount and fund on Terrace’s current donation page.</p><a class="button button-coral" href={official.donate} target="_blank" rel="noopener noreferrer">Give to Terrace <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></div>
    </div>
  {/if}
  <p class="giving-footnote">Questions about a gift, employer matching, or giving in someone’s name? <a href="mailto:info@princetonterraceclub.org">Talk with the club</a>.</p>
</section>

<style>
  .giving-hero{background:#211c2a;color:#faf7ed;padding:4rem 0 3rem;overflow:hidden}
  .giving-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:3rem;align-items:center}
  .giving-intro h1{font-size:clamp(3.3rem,7.5vw,7.2rem);line-height:.96;letter-spacing:-.045em;margin:1.2rem 0 1.8rem}
  .giving-intro h1 em{color:#ddec85}.giving-intro>p{max-width:32rem;font-size:1.2rem;line-height:1.7;margin-bottom:2rem}
  .giving-photo{margin:0;background:#eee4f7;color:#211c2a;padding:.8rem .8rem 0;transform:rotate(2deg);box-shadow:10px 10px 0 #6b5277}
  .giving-photo img{width:100%;height:auto;display:block}.giving-photo figcaption{font-size:.75rem;line-height:1.5;padding:.9rem .2rem}
  .giving-body{padding-top:4.5rem;padding-bottom:4.5rem;scroll-margin-top:2rem}.giving-heading{max-width:43rem;margin-bottom:2.5rem}
  .giving-heading h2{font-size:clamp(2.5rem,5vw,4.8rem);line-height:1.04;margin:1rem 0}.giving-heading>p{font-size:1.1rem}
  .giving-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:1.3rem}
  .giving-option{padding:2rem;border:2px solid #203f33;background:#fffdf6;box-shadow:5px 5px 0 #203f33}.giving-option h3{font-size:2rem;line-height:1.1;margin:1rem 0}.giving-option>p{line-height:1.65}
  .giving-amount{font-size:1.45rem;font-weight:750;margin-top:1.5rem}.giving-option .button{margin-top:1rem}.test-notice{border:2px dashed #203f33;background:#ddec85;padding:1rem;margin-bottom:1.5rem}
  .giving-current{display:flex;align-items:center;gap:2rem;background:#e8ecce;padding:2rem;border-top:3px solid #203f33;border-bottom:3px solid #203f33}.giving-current img{flex:none;max-width:35%;height:auto;transform:rotate(-5deg)}
  .giving-current h3{font-size:clamp(1.8rem,3vw,2.8rem);margin:0 0 1rem}.giving-current p{margin-bottom:1.5rem;line-height:1.65}
  .giving-footnote{font-size:.95rem;line-height:1.7;max-width:48rem;margin-top:2rem}
  @media(max-width:720px){.giving-grid{grid-template-columns:1fr;gap:2.5rem}.giving-hero{padding-top:2.5rem}.giving-photo{max-width:30rem;margin:0 .6rem}.giving-current{padding:1.5rem;gap:1rem;flex-direction:column;align-items:flex-start}.giving-current img{width:110px;max-width:100%}}
</style>
