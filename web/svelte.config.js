import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter(),
    // The launcher isolates dev servers; the default stays available to sync/check.
    outDir: process.env.TERRACE_KIT_OUT_DIR ?? '.svelte-kit'
  }
};
