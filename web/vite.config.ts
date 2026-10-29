import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    watch: {
      // devenv profiles link into the Nix store, outside this application's source.
      followSymlinks: false,
      ignored: ['**/.devenv/**', '**/.direnv/**']
    }
  }
});
