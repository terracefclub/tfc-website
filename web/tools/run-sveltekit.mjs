import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const [command, ...args] = process.argv.slice(2);

if (!['dev', 'build', 'preview'].includes(command)) {
  throw new Error(`Unsupported SvelteKit command: ${command ?? '(missing)'}`);
}

// Vite still reads the root tsconfig.json, which extends this generated file.
// Keep that type-check config at its default location while the dev server has
// an isolated manifest. Build and preview share one stable output directory.
const sync = spawnSync(process.execPath, [resolve(root, 'node_modules/@sveltejs/kit/svelte-kit.js'), 'sync'], {
  cwd: root,
  env: { ...process.env, TERRACE_KIT_OUT_DIR: '.svelte-kit' },
  stdio: 'inherit'
});

if (sync.error) throw sync.error;
if (sync.status !== 0) process.exit(sync.status ?? 1);

const vite = resolve(root, 'node_modules/vite/bin/vite.js');
const viteCommand = command;
const outDir = command === 'dev' ? `.svelte-kit/dev-${process.pid}` : '.svelte-kit/build';
const child = spawn(process.execPath, [vite, viteCommand, ...(command === 'dev' || command === 'preview' ? ['--host', '127.0.0.1'] : []), ...args], {
  cwd: root,
  env: { ...process.env, TERRACE_KIT_OUT_DIR: outDir },
  stdio: 'inherit'
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', error => {
  console.error(`Could not start Vite: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
