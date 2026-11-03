import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localFixtureCredentials } from '../tools/local-fixtures'

const state = mkdtempSync(join(tmpdir(), 'terrace-fixture-test-'))
const file = join(state, 'credentials.json')
const marker = 'synthetic-private-marker-never-print'
const invalid = 'Dedicated local fixture credentials are unavailable or invalid.'
afterAll(() => rmSync(state, { recursive: true, force: true }))

test('local credentials return only the string keys required by the selected mode', () => {
  writeFileSync(file, JSON.stringify({ memberPassword: 'synthetic-member', editorialAdminPassword: 'synthetic-admin', unrelated: marker }), { mode: 0o600 })
  expect(localFixtureCredentials(state, ['memberPassword'])).toEqual({ memberPassword: 'synthetic-member' })
  expect(localFixtureCredentials(state, ['memberPassword', 'editorialAdminPassword'])).toEqual({ memberPassword: 'synthetic-member', editorialAdminPassword: 'synthetic-admin' })
})

test('missing, empty, non-string and non-object credentials produce only a static error', () => {
  for (const data of [null, [], marker, {}, { memberPassword: '' }, { memberPassword: 123 }, { memberPassword: { private: marker } }]) {
    writeFileSync(file, JSON.stringify(data), { mode: 0o600 })
    expect(() => localFixtureCredentials(state, ['memberPassword'])).toThrow(invalid)
  }
  expect(() => localFixtureCredentials(join(state, 'missing'), ['memberPassword'])).toThrow(invalid)
})

test('a corrupt credential file cannot leak a private marker through uncaught stderr', async () => {
  writeFileSync(file, `{"memberPassword":"${marker}`, { mode: 0o600 })
  const loader = fileURLToPath(new URL('../tools/local-fixtures.ts', import.meta.url))
  const child = Bun.spawn([process.execPath, '--eval', `import { localFixtureCredentials } from ${JSON.stringify(loader)}; localFixtureCredentials(process.env.TERRACE_FIXTURE_TEST_STATE, ['memberPassword']);`], {
    env: { ...process.env, TERRACE_FIXTURE_TEST_STATE: state }, stdout: 'pipe', stderr: 'pipe',
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(code).not.toBe(0)
  expect(stderr).toContain(invalid)
  expect(stderr).not.toContain(marker)
  expect(stdout).not.toContain(marker)
})
