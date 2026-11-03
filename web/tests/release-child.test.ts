import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { stopOwnedGroup } from '../../tools/release/child'

test('cancellation escalates only the recorded detached group after five seconds', async () => {
  const steps: unknown[] = []
  await stopOwnedGroup(42424, {
    signal: (pid, signal) => { steps.push([pid, signal]) },
    pause: async duration => { steps.push(duration) },
  })
  expect(steps).toEqual([[-42424, 'SIGTERM'], 5000, [-42424, 'SIGKILL']])
})

test('smoke entrypoint loads its TS helper and rejects invalid input without disclosure or fixture startup', () => {
  const marker = 'PRIVATE_REJECTED_INPUT_MARKER'
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../tools/release/smoke.ts', import.meta.url)), marker, 'extra'], {
    encoding: 'utf8', timeout: 2000,
  })
  expect(result.status).toBe(1)
  expect(result.signal).toBeNull()
  expect(result.stdout).toBe('')
  expect(result.stderr).toContain('Relocated release proof failed during arguments;')
  expect(result.stderr).not.toContain(marker)
})

test('finished groups need no wait and invalid process identifiers cannot signal anything', async () => {
  let calls = 0
  const hooks = {
    signal: () => { calls++; throw Object.assign(new Error(), { code: 'ESRCH' }) },
    pause: async () => { throw new Error('must not wait') },
  }
  await stopOwnedGroup(42424, hooks)
  expect(calls).toBe(1)
  for (const invalid of [0, 1, -4, 1.2, NaN]) await expect(stopOwnedGroup(invalid, hooks)).rejects.toThrow('Invalid owned process group.')
  expect(calls).toBe(1)
})
