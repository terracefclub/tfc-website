import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const kitDir = resolve(root, '.svelte-kit');
const lockPath = resolve(kitDir, '.terrace-sync.lock');
const maxWaitMs = 15_000;
const pollIntervalMs = 50;

mkdirSync(kitDir, { recursive: true });

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function acquireLock() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const token = randomUUID();
    let descriptor;
    try {
      descriptor = openSync(lockPath, 'wx');
      writeFileSync(descriptor, `${process.pid} ${token}`);
      return { descriptor, token };
    } catch (error) {
      if (descriptor !== undefined) {
        closeSync(descriptor);
        if (readLockOwner()?.token === token) unlinkSync(lockPath);
      }
      if (error.code !== 'EEXIST') throw error;

      await sleep(pollIntervalMs);
    }
  }

  const owner = readLockOwner();
  const ownerMessage = owner ? ` (held by PID ${owner.pid})` : '';
  throw new Error(`Timed out waiting for the SvelteKit sync lock${ownerMessage}; remove ${lockPath} if its process is no longer running.`);
}

function readLockOwner() {
  try {
    const [pidText, token] = readFileSync(lockPath, 'utf8').trim().split(/\s+/);
    const pid = Number(pidText);
    return Number.isInteger(pid) && pid > 0 && token ? { pid, token } : undefined;
  } catch {
    return undefined;
  }
}

const lock = await acquireLock();
let syncStatus = 1;
try {
  const sync = spawnSync(process.execPath, [resolve(root, 'node_modules/@sveltejs/kit/svelte-kit.js'), 'sync'], {
    cwd: root,
    env: { ...process.env, TERRACE_KIT_OUT_DIR: '.svelte-kit' },
    stdio: 'inherit'
  });

  if (sync.error) throw sync.error;
  syncStatus = sync.status ?? 1;
} finally {
  closeSync(lock.descriptor);
  if (readLockOwner()?.token === lock.token && existsSync(lockPath)) unlinkSync(lockPath);
}

process.exitCode = syncStatus;
