import { spawn } from 'node:child_process';
import { chmodSync, closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localCmsOrigin, previewOrigin } from '../src/lib/server/local-preview';

const root = fileURLToPath(new URL('..', import.meta.url));

export function previewEnvironment(env: NodeJS.ProcessEnv) {
  const origin = localCmsOrigin(env.TERRACE_LOCAL_PREVIEW_ORIGIN || previewOrigin);
  const cms = localCmsOrigin(env.CMS_ORIGIN || 'http://127.0.0.1:3040');
  if (!origin || !cms || cms === origin) {
    throw new Error('CMS_ORIGIN must be a separate plain HTTP loopback origin.');
  }
  for (const name of ['MEMBER_AUTH_ISSUER', 'MEMBER_AUTH_CLIENT_ID', 'MEMBER_AUTH_CLIENT_SECRET']) {
    if (!env[name]) throw new Error('Load the local identity environment with identity/tools/with-local first.');
  }
  return { ...env, CMS_ORIGIN: cms, CONTENT_SOURCE: 'preview', MEMBER_AUTH_ORIGIN: origin, TERRACE_LOCAL_PREVIEW: '1' };
}

export async function requireFreePort(port: number) {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`Loopback port ${port} is occupied; existing processes were left running.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve()));
  });
}

async function main() {
  const env = previewEnvironment(process.env);
  const port = Number(new URL(env.MEMBER_AUTH_ORIGIN).port);
  await requireFreePort(port);
  process.umask(0o077);
  const state = resolve(root, '.state');
  mkdirSync(state, { recursive: true, mode: 0o700 });
  chmodSync(state, 0o700);
  const logPath = resolve(state, 'local-preview.log');
  const pidPath = resolve(state, 'local-preview.pid');
  const log = openSync(logPath, 'a', 0o600);
  chmodSync(logPath, 0o600);
  const child = spawn('node', [resolve(root, 'tools/run-sveltekit.mjs'), 'dev', '--port', String(port), '--strictPort'], {
    cwd: root, env, detached: true, stdio: ['ignore', log, log],
  });
  closeSync(log);
  await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  writeFileSync(pidPath, `${child.pid}\n`, { mode: 0o600 });
  if (process.env.TERRACE_LOCAL_STACK_RUN) writeFileSync(resolve(state, 'local-stack-start.json'), JSON.stringify({ run: process.env.TERRACE_LOCAL_STACK_RUN, pid: child.pid }), { mode: 0o600 });
  chmodSync(pidPath, 0o600);
  child.unref();
  console.log(`Detached preview starting at ${env.MEMBER_AUTH_ORIGIN}/ (PID ${child.pid}).`);
  console.log(`Private runtime files: ${pidPath} and ${logPath}`);
}

if (import.meta.main) main().catch(() => {
  console.error('Preview could not start. Check the loopback port, identity environment and private runtime files.');
  process.exitCode = 1;
});
