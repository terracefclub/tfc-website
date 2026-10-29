<script lang="ts">
  import { eventDateParts, official } from '$lib/content';
  import type { PageData } from './$types';
  export let data: PageData;
  $: date = eventDateParts(data.event.startsAt);
</script>

<svelte:head><title>{data.event.title} · Terrace F. Club</title><meta name="description" content={data.event.excerpt} /></svelte:head>
<div class="event-world" data-category={data.event.category}>
  <section class="event-head">
    <div class="shell"><a class="back-link" href="/events/">← Back to the noticeboard</a>
      <div class="event-head-grid" class:with-image={Boolean(data.event.image)}>
        <div><p class="event-overline">{data.event.category.toUpperCase()} AT TERRACE{#if data.event.preview} · SAMPLE EVENT{/if}</p><h1>{data.event.title}</h1><p class="event-intro">{data.event.excerpt}</p>{#if data.event.preview}<p class="imagined-stamp">IMAGINED FOR THE PREVIEW · NOT SCHEDULED</p>{/if}</div>
        {#if data.event.image}<figure><img src={data.event.image.url} alt={data.event.image.alt} width={data.event.image.width} height={data.event.image.height} fetchpriority="high" /><figcaption><a href={data.event.image.sourceUrl}>{data.event.image.caption} ↗</a></figcaption></figure>{/if}
      </div>
    </div>
  </section>
  <div class="shell detail-layout">
    <div class="prose"><p class="event-overline">{data.event.preview ? 'A LITTLE WHAT IF' : 'THE PLAN'}</p><h2>{data.event.preview ? 'Picture this.' : 'Come on over.'}</h2>{#each data.event.description.split('\n\n') as paragraph}<p>{paragraph}</p>{/each}{#if data.event.preview}<p class="reality-note">This is a fictional event. Check the official calendar before making plans.</p><a class="text-link" href={official.events} target="_blank" rel="noopener noreferrer">Visit the official events calendar <span class="sr-only">(opens in a new tab)</span> ↗</a>{/if}</div>
    <aside class="detail-sidebar"><p class="ticket-label">{data.event.preview ? 'SPECIMEN / NOT A TICKET' : 'KEEP THE DETAILS'}</p><h2>{data.event.preview ? 'If this were happening…' : 'The particulars'}</h2><p><strong>Date</strong><br /><time datetime={data.event.startsAt}>{date.full}</time></p><p><strong>Time</strong><br />{date.time}</p><p><strong>Place</strong><br />{data.event.location}</p>{#if data.event.preview}<p><strong>Status</strong><br />Sample listing · not scheduled</p><a class="button button-dark" href={official.events} target="_blank" rel="noopener noreferrer">Official calendar <span aria-hidden="true">↗</span><span class="sr-only">(opens in a new tab)</span></a>{/if}</aside>
  </div>
</div>

<style>
  .event-world { --event-color:#f4d866; color:#33253a; background:#fff7e8; overflow:clip; }
  .event-world[data-category='music'] { --event-color:#efaab6; }
  .event-world[data-category='community'] { --event-color:#b7d6d8; }
  .event-head { padding-block:40px 70px; background:var(--event-color); border-bottom:2px solid #33253a; }
  .back-link { margin-bottom:45px; }
  .event-head-grid.with-image { display:grid; grid-template-columns:1.1fr 1fr; align-items:center; gap:60px; }
  .event-overline { font-size:11px; font-weight:800; letter-spacing:.1em; }
  h1 { margin-block:20px 28px; max-width:850px; font:400 clamp(54px,7vw,98px)/1 'Anton',Impact,sans-serif; text-transform:uppercase; letter-spacing:-.02em; overflow-wrap:anywhere; }
  .event-intro { max-width:570px; font-size:17px; line-height:1.8; }
  .imagined-stamp { display:inline-block; margin-top:17px; padding:8px 12px; border:2px solid #33253a; font-size:9px; font-weight:800; letter-spacing:.03em; transform:rotate(-2deg); }
  figure { margin:0; padding:12px; background:#fff7e8; box-shadow:10px 10px 0 #33253a; transform:rotate(1deg); }
  figure img { width:100%; height:auto; }
  figcaption { padding:14px 4px 5px; font-size:11px; line-height:1.55; }
  figcaption a { text-decoration:underline; text-underline-offset:2px; }
  .prose p { color:#33253a; }
  .prose h2 { margin-top:18px; font-size:50px; }
  .reality-note { border-left:3px solid #33253a; padding-left:18px; font-size:13px; }
  .detail-sidebar { padding:25px; border:1px solid #33253a; border-top:12px solid #33253a; background:var(--event-color); box-shadow:5px 6px 0 #33253a; }
  .detail-sidebar .ticket-label { padding-bottom:17px; margin-bottom:20px; border-bottom:1px dashed #33253a; font-size:9px; font-weight:800; letter-spacing:.05em; }
  .detail-sidebar h2 { font:400 30px/1.1 'Anton',Impact,sans-serif; letter-spacing:0; margin-bottom:25px; text-transform:none; }
  .detail-sidebar strong { font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
  .detail-sidebar .button { background:#33253a; }
  @media(max-width:800px) { .event-head-grid.with-image { grid-template-columns:1fr; gap:30px; } figure { max-width:600px; margin-inline:5px; } .event-head { padding-block:30px 50px; } .back-link { margin-bottom:30px; } h1 { font-size:clamp(54px,11vw,85px); } .detail-layout { gap:35px; } }
</style>
