import { expect, test } from 'bun:test'
import { portAvailable, processIdentity, sameProcess, stackPorts } from '../../tools/local-stack.ts'

test('local stack has exact loopback defaults and accepts distinct bounded port overrides', () => {
  expect(stackPorts([])).toEqual({ mode: 'start', ports: { identity: 8186, cms: 3040, web: 4194 } })
  expect(stackPorts(['status'], { identity: 8190, cms: 3046, web: 4252 })).toEqual({ mode: 'status', ports: { identity: 8190, cms: 3046, web: 4252 } })
  expect(stackPorts(['start', '--identity-port', '8190', '--cms-port', '3046', '--web-port', '4252']).ports).toEqual({ identity: 8190, cms: 3046, web: 4252 })
})
test('local stack refuses malformed, duplicate, privileged and management-conflicting ports', () => {
  for (const args of [ ['stop'], ['--web-port'], ['--host', '0.0.0.0'], ['--web-port', 'https://external.invalid'], ['--web-port', '80'], ['--identity-port', '64536'], ['--web-port', '3040'], ['--web-port', '9186'], ['--cms-port', '3.1'] ]) expect(() => stackPorts(args)).toThrow()
  expect(() => stackPorts([], { identity: 8186, cms: '3040', web: 4194 } as any)).toThrow()
  expect(sameProcess({ pid: -1, fingerprint: undefined } as any)).toBe(false)
})
test('bind probing refuses an occupied port without needing to discover its process identity', async () => {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('synthetic listener') })
  try {
    expect(await portAvailable(server.port!)).toBe(false)
    expect((await fetch(`http://127.0.0.1:${server.port}/`)).status).toBe(200)
  } finally { server.stop(true) }
})
const inspectTest = processIdentity(process.pid) ? test : test.skip
inspectTest('process ownership includes cwd, start identity and argv rather than accepting a reused PID', async () => {
  const child = Bun.spawn([process.execPath, '--eval', 'setInterval(() => {}, 1000)'], { cwd: import.meta.dir, stdout: 'ignore', stderr: 'ignore' })
  try {
    const info = processIdentity(child.pid)
    expect(info?.cwd).toBe(import.meta.dir)
    expect(info?.argv).toContain('setInterval')
    expect(sameProcess({ pid: child.pid, fingerprint: info!.fingerprint })).toBe(true)
    expect(sameProcess({ pid: child.pid, fingerprint: 'a-prior-process-with-this-pid' })).toBe(false)
    expect(child.exitCode).toBeNull()
  } finally { child.kill(); await child.exited }
  expect(processIdentity(child.pid)).toBeNull()
})
