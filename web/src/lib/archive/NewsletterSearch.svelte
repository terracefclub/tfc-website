<script lang="ts">
  import { onMount } from 'svelte';
  import { archiveIssues } from './content';
  import { loadSearchIndex } from './search-client';
  import { groupByIssue, resultTarget, searchIndex, type SearchIndex, type SearchResult } from './search';

  export let currentIssue: string;
  export let onjump: (page: number) => void;

  const DEBOUNCE_MS = 200;
  const SHOWN = 30;
  let enhanced = false;
  let query = '';
  let status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  let index: SearchIndex | undefined;
  let results: SearchResult[] = [];
  let searched = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let showAll = false;

  $: shown = showAll ? results : results.slice(0, SHOWN);
  $: groups = groupByIssue(shown);
  $: message = status === 'loading' ? 'Loading the page text…'
    : status === 'error' ? 'Search could not load. Check your connection and try again.'
    : !searched ? ''
    : results.length === 0 ? `No pages match “${searched}”.`
    : `${results.length} ${results.length === 1 ? 'page matches' : 'pages match'} “${searched}”.` + (results.length > shown.length ? ` Showing the first ${shown.length}.` : '');

  const label = (slug: string) => archiveIssues.find((issue) => issue.slug === slug)?.label ?? slug;

  async function run() {
    const text = query.trim();
    if (!text) { results = []; searched = ''; if (status !== 'error') status = index ? 'ready' : 'idle'; return; }
    if (!index) {
      status = 'loading';
      try { index = await loadSearchIndex(); } catch { status = 'error'; return; }
    }
    // A newer keystroke may have arrived while the index loaded.
    if (query.trim() !== text) return;
    status = 'ready';
    showAll = false;
    results = searchIndex(index, text);
    searched = text;
  }

  function onInput() {
    clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
    // Start fetching as soon as someone types, so the first search is not delayed by the debounce.
    if (!index && query.trim()) loadSearchIndex().catch(() => undefined);
  }

  function open(result: SearchResult, event?: MouseEvent) {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    if (!resultTarget(result, currentIssue).sameIssue) return;
    event?.preventDefault();
    onjump(result.page);
  }

  async function submit(event: Event) {
    event.preventDefault();
    clearTimeout(timer);
    await run();
    const first = results[0];
    if (!first) return;
    const target = resultTarget(first, currentIssue);
    if (target.sameIssue) onjump(first.page);
    else location.assign(target.href);
  }

  function clear() { clearTimeout(timer); query = ''; results = []; searched = ''; status = index ? 'ready' : 'idle'; }

  onMount(() => { enhanced = true; return () => clearTimeout(timer); });
</script>

{#if enhanced}
  <section class="reader-search shell" aria-labelledby="reader-search-title">
    <h3 id="reader-search-title">Search every newsletter</h3>
    <form role="search" on:submit={submit}>
      <label for="reader-search-input">Find a word or name in the page text</label>
      <div class="reader-search-line">
        <input id="reader-search-input" type="search" bind:value={query} on:input={onInput} on:keydown={(event) => event.key === 'Escape' && clear()} placeholder="Try quiche, applejack, Reunions…" maxlength="100" autocomplete="off" spellcheck="false" aria-describedby="reader-search-note" />
        <button type="submit">Go to first match</button>
      </div>
      <p id="reader-search-note" class="reader-search-note">Searches text read from all {archiveIssues.reduce((sum, issue) => sum + issue.pageCount, 0)} pages by machine, so a word in lettering or over a photograph may be missed. Enter opens the first match.</p>
    </form>
    <p class="reader-search-status" role="status" aria-live="polite">{message}</p>
    {#if groups.length}
      <ul class="reader-search-results" aria-label="Search results">
        {#each groups as group (group.issue)}
          <li class="reader-search-group">
            <h4>{label(group.issue)}</h4>
            <ul>
              {#each group.results as result (result.issue + result.page)}
                {@const target = resultTarget(result, currentIssue)}
                <li>
                  <a href={target.href} on:click={(event) => open(result, event)}>
                    <span class="reader-search-page">Page {result.page}<span class="sr-only">, {label(result.issue)}</span></span>
                    <span class="reader-search-snippet">{#each result.snippet as part}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</span>
                  </a>
                </li>
              {/each}
            </ul>
          </li>
        {/each}
      </ul>
      {#if results.length > shown.length}<button type="button" class="reader-search-more" on:click={() => showAll = true}>Show all {results.length} matches</button>{/if}
    {/if}
  </section>
{/if}

<style>
  .reader-search { padding-block:0 34px; color:#292336; }
  .reader-search h3 { margin:0 0 12px; font:italic 700 26px 'Fraunces Variable',Georgia,serif; }
  .reader-search label { display:block; margin-bottom:8px; font-size:13px; font-weight:800; }
  .reader-search-line { display:flex; gap:10px; max-width:720px; }
  input { flex:1; min-width:0; min-height:46px; padding:8px 12px; border:2px solid #292336; border-radius:0; background:#fffaf0; color:#292336; font:inherit; font-size:16px; }
  button { border:1px solid #c6bacd; border-radius:0; min-height:46px; padding:0 16px; background:#fffaf0; color:#292336; font:inherit; font-size:14px; font-weight:800; cursor:pointer; }
  button:hover { background:#e0ed93; }
  input:focus-visible,button:focus-visible,a:focus-visible { outline:3px solid #733748; outline-offset:2px; }
  .reader-search-note { max-width:720px; margin:10px 0 0; font-size:12px; line-height:1.6; color:#4d4256; }
  .reader-search-status { min-height:1.6em; margin:14px 0 0; font-size:14px; font-weight:700; }
  .reader-search-results,.reader-search-results ul { margin:0; padding:0; list-style:none; }
  .reader-search-results { max-width:900px; }
  .reader-search-group h4 { margin:18px 0 6px; padding-bottom:6px; border-bottom:2px solid #292336; font-size:13px; letter-spacing:.06em; text-transform:uppercase; }
  .reader-search-group a { display:grid; grid-template-columns:78px minmax(0,1fr); gap:14px; padding:12px 8px; border-bottom:1px solid #29233624; font-size:15px; line-height:1.55; text-decoration:none; color:inherit; }
  .reader-search-group a:hover { background:#fffaf0; }
  .reader-search-page { font-size:12px; font-weight:800; letter-spacing:.04em; color:#733748; }
  .reader-search-snippet { overflow-wrap:anywhere; }
  mark { background:#e0ed93; color:inherit; padding:0 1px; }
  .reader-search-more { margin-top:14px; }
  @media(max-width:500px) { .reader-search-line { flex-direction:column; } .reader-search-group a { grid-template-columns:1fr; gap:2px; } }
</style>
