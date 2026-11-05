import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { groupProcesses, portAvailable, processIdentity, processStat, sameProcess, stackPorts, stopProcessGroup } from '../../tools/local-stack.ts'

test('local stack has exact loopback defaults and accepts distinct bounded port overrides', () => {
  expect(stackPorts([])).toEqual({ mode: 'start', ports: { identity: 8186, cms: 3040, web: 4194 } })
  expect(stackPorts(['status'], { identity: 8190, cms: 3046, web: 4252 })).toEqual({ mode: 'status', ports: { identity: 8190, cms: 3046, web: 4252 } })
  expect(stackPorts(['start', '--identity-port', '8190', '--cms-port', '3046', '--web-port', '4252']).ports).toEqual({ identity: 8190, cms: 3046, web: 4252 })
  expect(stackPorts(['stop'], { identity: 8190, cms: 3046, web: 4252 }).mode).toBe('stop')
})
test('local stack refuses malformed, duplicate, privileged and management-conflicting ports', () => {
  for (const args of [ ['erase'], ['--web-port'], ['--host', '0.0.0.0'], ['--web-port', 'https://external.invalid'], ['--web-port', '80'], ['--identity-port', '64536'], ['--web-port', '3040'], ['--web-port', '9186'], ['--cms-port', '3.1'] ]) expect(() => stackPorts(args)).toThrow()
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

async function fixture(code: string, cwd = import.meta.dir, marker = '', program = process.execPath, readyMs = 5000) {
  const script = program === '/bin/sh' ? code : `setTimeout(()=>process.exit(87),8000).unref(); ${code}`
  const child = spawn(program, program === '/bin/sh' ? ['-c', script] : ['--eval', script, marker], { cwd, detached: true, stdio: ['ignore', 'pipe', 'ignore'] })
  const exited = new Promise<void>(done => child.once('exit', () => done()))
  let initialized = false, timer: ReturnType<typeof setTimeout> | undefined
  try {
    const line = await new Promise<string>((done, fail) => {
      timer = setTimeout(() => fail(new Error('Synthetic process did not become ready.')), readyMs)
      child.once('error', () => { clearTimeout(timer); fail(new Error('Synthetic process failed.')) })
      child.once('exit', () => { clearTimeout(timer); fail(new Error('Synthetic process exited before readiness.')) })
      child.stdout!.once('data', data => { clearTimeout(timer); done(String(data).trim()) })
    })
    const info = processIdentity(child.pid!)
    if (!info) throw new Error('Synthetic process identity unavailable.')
    const members = groupProcesses(info.group).flatMap(pid => { const member = processIdentity(pid); return member ? [{ pid, fingerprint: member.fingerprint, group: member.group }] : [] })
    initialized = true
    return { child, exited, line, record: { pid: child.pid!, fingerprint: info.fingerprint, group: info.group }, members }
  } catch {
    throw Object.assign(new Error('Synthetic fixture setup failed.'), { pid: child.pid })
  } finally {
    clearTimeout(timer)
    if (!initialized && child.pid) {
      const info = processIdentity(child.pid)
      if (info?.group === child.pid && info.cwd === realpathSync(cwd) && info.argv.includes(script) && sameProcess({ pid: child.pid, fingerprint: info.fingerprint })) {
        try { process.kill(-child.pid, 'SIGKILL') } catch { /* already exited */ }
      }
      // Controlled scripts also have a finite fallback if inspection is unavailable.
      for (let i = 0; i < 180 && groupProcesses(child.pid).length; i++) await delay(50)
      if (groupProcesses(child.pid).length) throw new Error('Synthetic initialization cleanup could not be verified.')
    }
  }
}
async function dispose(owned: Awaited<ReturnType<typeof fixture>>) {
  // Only exact synthetic identities captured while this test's leader existed.
  const anchored = owned.members.some(member => sameProcess(member) && processIdentity(member.pid)?.group === member.group)
  const members = anchored ? groupProcesses(owned.record.group).flatMap(pid => { const info = processIdentity(pid); return info ? [{ pid, fingerprint: info.fingerprint, group: info.group }] : [] }) : []
  for (const member of members) if (sameProcess(member) && processIdentity(member.pid)?.group === member.group) {
    try { process.kill(member.pid, 'SIGKILL') } catch { /* exited */ }
  }
  for (let i = 0; i < 100 && groupProcesses(owned.record.group).length; i++) await delay(10)
  if (groupProcesses(owned.record.group).length) throw new Error('Synthetic process cleanup could not be verified.')
}

inspectTest('graceful stop verifies identity and group, preserves unrelated listeners and is repeatable', async () => {
  const owned = await fixture('process.on("SIGTERM",()=>process.exit(0)); console.log("ready"); setInterval(()=>{},1000)')
  const sentinel = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('unrelated') })
  try {
    await expect(stopProcessGroup({ ...owned.record, fingerprint: '0'.repeat(64) })).rejects.toThrow('identity changed')
    await expect(stopProcessGroup({ ...owned.record, group: process.pid })).rejects.toThrow('cannot be verified')
    expect(sameProcess(owned.record)).toBe(true)
    expect((await fetch(`http://127.0.0.1:${sentinel.port}/`)).status).toBe(200)
    await stopProcessGroup(owned.record)
    await owned.exited
    expect(groupProcesses(owned.record.group)).toEqual([])
    await stopProcessGroup(owned.record)
    expect((await fetch(`http://127.0.0.1:${sentinel.port}/`)).status).toBe(200)
  } finally { await dispose(owned); sentinel.stop(true) }
})

inspectTest('shutdown reports surviving children instead of signaling a group with an absent leader', async () => {
  const stubborn = await fixture('trap "exit 0" TERM; /bin/sh -c \'trap "" TERM; sleep 5 & echo ready; wait\' & wait', import.meta.dir, '', '/bin/sh')
  try {
    await expect(stopProcessGroup(stubborn.record, 150)).rejects.toThrow('surviving children')
    await stubborn.exited
    expect(groupProcesses(stubborn.record.group).length).toBeGreaterThan(0)
    await expect(stopProcessGroup(stubborn.record, 150)).rejects.toThrow('no signal was sent')
  } finally { await dispose(stubborn) }
  expect(groupProcesses(stubborn.record.group)).toEqual([])
})

inspectTest('a detached fixture that never becomes ready cleans itself before rejecting', async () => {
  let pid: number | undefined
  try { await fixture('setInterval(()=>{},1000)', import.meta.dir, '', process.execPath, 100) } catch (error) {
    expect((error as Error).message).toBe('Synthetic fixture setup failed.')
    pid = (error as { pid: number }).pid
  }
  expect(pid).toBeNumber()
  expect(processIdentity(pid!)).toBeNull()
  expect(groupProcesses(pid!)).toEqual([])
})

const commandTest = processIdentity(process.pid) && Bun.which('lsof') ? test : test.skip
commandTest('stop continues other owned components after uncertain ownership and retains every state file', async () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'local-stack-stop-'))
  let web: Awaited<ReturnType<typeof fixture>> | undefined, cms: Awaited<ReturnType<typeof fixture>> | undefined
  try {
    for (const kind of ['identity', 'cms', 'web']) mkdirSync(join(root, kind, '.state'), { recursive: true })
    mkdirSync(join(root, 'tools'))
    const tool = join(root, 'tools/local-stack.ts')
    copyFileSync(join(import.meta.dir, '../../tools/local-stack.ts'), tool)
    const free = async (port: number) => { while (!await portAvailable(port)) port++; return port }
    const server = (port: number) => `process.on("SIGTERM",()=>setTimeout(()=>process.exit(0),600)); const server=Bun.serve({hostname:"127.0.0.1",port:${port},fetch:()=>new Response("synthetic")}); console.log(server.port); setInterval(()=>{},1000)`
    web = await fixture(server(await free(42000)), join(root, 'web'), join(root, 'web/tools/run-sveltekit.mjs'))
    cms = await fixture(server(await free(43000)), join(root, 'cms'), join(root, 'cms/node_modules/.bin/next'))
    let identityPort = 40000
    while (!await portAvailable(identityPort) || !await portAvailable(identityPort + 1000) || [Number(web.line), Number(cms.line)].includes(identityPort)) identityPort++
    const saved = { identity: identityPort, cms: Number(cms.line), web: Number(web.line) }
    writeFileSync(join(root, 'identity/.state/local-stack-config.json'), JSON.stringify(saved))
    writeFileSync(join(root, 'web/.state/local-stack.json'), JSON.stringify({ ...web.record, root, kind: 'web', port: saved.web }))
    writeFileSync(join(root, 'cms/.state/local-stack.json'), JSON.stringify({ ...cms.record, fingerprint: '0'.repeat(64), root, kind: 'cms', port: saved.cms }))
    const retained = join(root, 'web/.state/retained-synthetic-data')
    writeFileSync(retained, 'preserved')
    const stop = () => Bun.spawnSync([process.execPath, tool, 'stop'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const first = Bun.spawn([process.execPath, tool, 'stop'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    for (let i = 0; i < 100 && !existsSync(join(root, 'identity/.state/local-stack.lock')); i++) await delay(5)
    const concurrent = stop()
    expect(concurrent.exitCode).toBe(1)
    expect(concurrent.stdout.toString()).toContain('Another lifecycle command may be running')
    expect(await first.exited).toBe(1)
    const firstOutput = await new Response(first.stdout).text()
    expect(firstOutput).toContain('Managed web stopped')
    expect(firstOutput).toContain('Managed cms shutdown could not be verified')
    expect(await new Response(first.stderr).text()).toBe('')
    await web.exited
    expect(await portAvailable(saved.web)).toBe(true)
    expect((await fetch(`http://127.0.0.1:${saved.cms}/`)).status).toBe(200)
    expect(readFileSync(retained, 'utf8')).toBe('preserved')
    await dispose(cms); await cms.exited
    unlinkSync(join(root, 'cms/.state/local-stack.json'))
    expect(stop().exitCode).toBe(0)
    expect(stop().exitCode).toBe(0)
    expect(readFileSync(retained, 'utf8')).toBe('preserved')
  } finally {
    if (web) await dispose(web)
    if (cms) await dispose(cms)
    rmSync(root, { recursive: true, force: true })
  }
}, 15000)

test('malformed process stat errors never echo source text', () => {
  const marker = 'PRIVATE_PROCESS_INSPECTION_MARKER'
  for (const input of [marker, `1 (${marker}) R 1 2`, `1 (${marker}) R 1 invalid ${'0 '.repeat(30)}`]) {
    expect(() => processStat(input)).toThrow('Process inspection data is invalid.')
    try { processStat(input) } catch (error) { expect((error as Error).message).not.toContain(marker) }
  }
})
const linuxTest = process.platform === 'linux' ? test : test.skip
linuxTest('only disappearing process races count as absent during group inspection', () => {
  for (const code of ['ENOENT', 'ESRCH']) expect(groupProcesses(23456, () => { throw Object.assign(new Error('private'), { code }) })).toEqual([])
  for (const code of ['EACCES', 'EPERM', 'EIO', undefined]) expect(() => groupProcesses(23456, () => { throw Object.assign(new Error('private'), { code }) })).toThrow('Process group inspection failed; absence was not inferred.')
})
