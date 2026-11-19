<script lang="ts">
  /** `html` must come from renderBody (server-side re-sanitized); nothing else may be passed here. */
  export let html: string;
</script>

<div class="rendered">{@html html}</div>

<style>
  .rendered { max-width: 760px; color: #455a4b; font-size: 18px; line-height: 1.75; overflow-wrap: anywhere; }
  .rendered :global(h2), .rendered :global(h3), .rendered :global(h4), .rendered :global(h5), .rendered :global(h6) { margin: 1.8em 0 .5em; color: #173f32; line-height: 1.15; }
  .rendered :global(h2) { font-size: clamp(30px, 3.6vw, 44px); }
  .rendered :global(h3) { font-size: clamp(24px, 2.8vw, 32px); }
  .rendered :global(h4), .rendered :global(h5), .rendered :global(h6) { font-size: 20px; }
  .rendered :global(p), .rendered :global(ul), .rendered :global(ol), .rendered :global(blockquote), .rendered :global(figure), .rendered :global(pre) { margin: 0 0 1.2em; }
  .rendered :global(p) { color: #455a4b; }
  .rendered :global(a) { text-decoration: underline; text-underline-offset: 3px; font-weight: 700; }
  .rendered :global(a:hover) { color: #bd4d3d; }
  .rendered :global(ul), .rendered :global(ol) { padding-left: 1.4em; }
  .rendered :global(blockquote) { padding: 4px 0 4px 20px; border-left: 4px solid #df906d; font-family: 'Fraunces Variable', Georgia, serif; }
  .rendered :global(img) { width: auto; max-width: 100%; height: auto; }
  .rendered :global(figure) { padding: 12px; background: #fff9e9; border: 1px solid #d7cbb3; }
  .rendered :global(figcaption) { padding-top: 10px; font-size: 14px; line-height: 1.5; }
  .rendered :global(pre) { overflow-x: auto; padding: 16px; background: #f3ead8; font-size: 14px; }
  .rendered :global(code) { font-size: .9em; }
  .rendered :global(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 0 0 1.2em; font-size: 16px; }
  .rendered :global(th), .rendered :global(td) { padding: 8px 12px; border: 1px solid #d7cbb3; text-align: left; vertical-align: top; }
  .rendered :global(th) { background: #f3ead8; }
  .rendered :global(hr) { margin: 2em 0; border: 0; border-top: 2px solid #d7cbb3; }
</style>
