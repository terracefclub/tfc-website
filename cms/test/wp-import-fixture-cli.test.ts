import { afterAll, beforeAll, expect, test } from 'bun:test'
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OutputRefused } from '../../web/tools/private-output'
import { failureLine, isLocalDatabase, parseArgs, productionGuard, readPlan } from '../tools/wp-import'
import { productionRealm } from '../../identity/tools/production-realm'

// The documented way to try the committed synthetic plan (docs/wordpress-import.md, "Trying the synthetic fixture"): copy it into a private
// directory with mode 0600, then run the CLI from there. Git checks the fixture out as 0644, which the tool rightly refuses.
const cms = join(import.meta.dir, '..')
const fixture = join(import.meta.dir, 'fixtures', 'wp-import-plan.synthetic.json')
const stamp = crypto.randomUUID().slice(0, 6)
const privateDirectory = mkdtempSync(join(tmpdir(), 'terrace-wp-fixture-'))
const plan = join(privateDirectory, 'wp-import-plan.json')
// CI runs against a database service that is not on the loopback; the tool's own guard asks for the explicit flag there (the local run needs none).
const nonlocal = isLocalDatabase(process.env.DATABASE_URI) ? [] : ['--allow-nonlocal-database']
const run = (args: string[]) => {
  const result = Bun.spawnSync(['bun', 'tools/wp-import.ts', ...args, ...nonlocal], { cwd: cms, env: process.env as Record<string, string>, stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const summaryOf = (out: string) => JSON.parse(out.slice(out.indexOf('\n{\n') + 1))
let n = 0
const report = () => join(privateDirectory, `report-${n++}.json`)

beforeAll(() => { if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('These tests require isolated local data.') })
afterAll(() => { rmSync(privateDirectory, { recursive: true, force: true }) })

test('a plan readable by others is refused with one fixed, path-free reason that says what to do', () => {
  copyFileSync(fixture, plan)
  chmodSync(plan, 0o644)
  expect(() => readPlan(plan)).toThrow('plan-file-permissions')
  chmodSync(plan, 0o640)
  expect(() => readPlan(plan)).toThrow('plan-file-permissions')
  const refused = run(['dry-run', '--plan', plan])
  expect(refused.code).toBe(1)
  expect(refused.out).not.toContain('{')
  expect(refused.err).toContain('readable only by its owner')
  expect(refused.err).toContain('chmod 600')
  expect(refused.err).not.toContain(privateDirectory)
  expect(refused.err).not.toContain('wp-import-plan')
  expect(refused.err.trim().split('\n')).toHaveLength(1)
})

test('the reason lines are fixed text: permissions, output location, and a generic line that never echoes content', () => {
  expect(failureLine(new Error('plan-file-permissions'))).toContain('mode 0600')
  expect(failureLine(new Error('plan-file-unsafe'))).toContain('regular file')
  const refusedOutput = new OutputRefused('Unsupported output: its directory is inside a Git checkout, including a git-ignored one. Create an owner-only directory outside every Git checkout (for example: mkdir -m 700 ~/.terrace-private) and give an absolute new .json path inside it.')
  expect(failureLine(refusedOutput)).toContain('inside a Git checkout')
  for (const secret of ['postgresql://user:hunter2@db.example.invalid/x', '/home/someone/private/plan.json', '{"title":"A private title"}']) {
    const line = failureLine(new Error(secret))
    expect(line).toStartWith('WordPress import failed.')
    expect(line).not.toContain(secret)
  }
  expect(failureLine('not an error')).toStartWith('WordPress import failed.')
  expect(failureLine(new Error('Usage: x'))).toBe('Usage: x')
})

test('a plan that is a link is refused, and a report inside a Git checkout is refused with its reason', () => {
  chmodSync(plan, 0o600)
  const link = join(privateDirectory, 'link.json')
  symlinkSync(plan, link)
  const linked = run(['dry-run', '--plan', link])
  expect(linked.code).toBe(1)
  expect(linked.err).toStartWith('WordPress import failed.')
  const insideCheckout = run(['dry-run', '--plan', plan, '--report', join(cms, '.state', 'should-not-exist.json')])
  expect(insideCheckout.code).toBe(1)
  expect(insideCheckout.err).toContain('Git checkout')
  expect(insideCheckout.err).not.toContain(cms)
})

test('the documented fixture steps work end to end: copy at 0600, dry-run, apply, re-apply is a no-op, rollback', () => {
  copyFileSync(fixture, plan)
  chmodSync(plan, 0o600)
  expect(statSync(plan).mode & 0o777).toBe(0o600)
  const id = `wpimport-test-fixture-${stamp}`
  const dry = run(['dry-run', '--plan', plan, '--report', report()])
  expect(dry.code).toBe(0)
  const planned = summaryOf(dry.out)
  expect(planned.mode).toBe('dry-run')
  expect(planned.counts.failed).toBe(0)
  expect(planned.counts.created).toBeGreaterThan(0)
  const applied = run(['apply', '--plan', plan, '--report', report(), '--run-id', id])
  expect(applied.code).toBe(0)
  expect(summaryOf(applied.out).counts.created).toBe(planned.counts.created)
  const again = run(['apply', '--plan', plan, '--report', report()])
  expect(again.code).toBe(0)
  expect(summaryOf(again.out).counts).toMatchObject({ created: 0, updated: 0, failed: 0 })
  const back = run(['rollback', '--run', id, '--report', report()])
  expect(back.code).toBe(0)
  expect(summaryOf(back.out).ok).toBe(true)
  for (const output of [dry, applied, again, back]) expect(output.out + output.err).not.toContain(privateDirectory)
  expect(readFileSync(plan, 'utf8').length).toBeGreaterThan(100)
}, 30_000)

function productionEnv(): Record<string, string | undefined> {
  const realm = productionRealm('https://www.terrace.example', 'https://editor.terrace.example', { webSecret: 'synthetic-web-'.repeat(4), introspectionSecret: 'synthetic-community-'.repeat(4), cmsSecret: 'synthetic-editor-'.repeat(4), editorialSecret: 'synthetic-editorial-'.repeat(4) })
  const editor = realm.clients.find((client) => client.redirectUris.some((uri) => uri.endsWith('/api/editorial/callback')))!
  const member = realm.clients.find((client) => client.redirectUris.some((uri) => uri.endsWith('/auth/callback')))!
  const resource = (client: typeof editor) => client.protocolMappers![0].config['included.custom.audience']
  const identity = 'https://identity.terrace.example/realms/terrace'
  return {
    CMS_PUBLIC_DEPLOYMENT: '1', CMS_ORIGIN: 'https://editor.terrace.example', CMS_MEDIA_DIR: '/var/lib/terrace-media', PAYLOAD_SECRET: 'synthetic-payload-'.repeat(4),
    CMS_AUTH_ISSUER: identity, CMS_AUTH_CLIENT_ID: editor.clientId, CMS_AUTH_AUDIENCE: resource(editor), CMS_AUTH_CLIENT_SECRET: editor.secret,
    CMS_AUTH_INTROSPECTION_CLIENT_ID: resource(editor), CMS_AUTH_INTROSPECTION_SECRET: 'synthetic-editorial-'.repeat(4),
    MEMBER_AUTH_ISSUER: identity, MEMBER_AUTH_CLIENT_ID: member.clientId, MEMBER_AUTH_AUDIENCE: resource(member), MEMBER_AUTH_INTROSPECTION_CLIENT_ID: resource(member),
    MEMBER_AUTH_INTROSPECTION_SECRET: 'synthetic-community-'.repeat(4), LIFECYCLE_OUTBOX_DIR: '/var/lib/terrace-outbox', LIFECYCLE_PUBLIC_ORIGIN: 'https://www.terrace.example',
    DATABASE_URI: 'postgresql:///terrace_cms?host=/run/postgresql',
  }
}

test('a public deployment is a production target: writes need its valid configuration and --confirm-production, reads need neither', () => {
  const flags = (...names: string[]) => new Set(names)
  const production = productionEnv()
  // The local profile (no CMS_PUBLIC_DEPLOYMENT) is unchanged: the local-database guard alone applies.
  expect(() => productionGuard({ DATABASE_URI: production.DATABASE_URI }, 'apply', flags())).not.toThrow()
  // Read-only commands need no confirmation, even on a production host.
  expect(() => productionGuard(production, 'dry-run', flags())).not.toThrow()
  expect(() => productionGuard(production, 'publish', flags('--dry-run'))).not.toThrow()
  // Every write: refused without the flag (although the database is a local socket), accepted with it.
  for (const [command, extra] of [['apply', []], ['publish', []], ['rollback', []], ['apply', ['--publish']]] as Array<[string, string[]]>) {
    expect(() => productionGuard(production, command, flags(...extra))).toThrow('Pass --confirm-production')
    expect(() => productionGuard(production, command, flags(...extra, '--confirm-production'))).not.toThrow()
  }
  // A public deployment with an incomplete configuration is refused, flag or not, without echoing any value.
  expect(() => productionGuard({ ...production, LIFECYCLE_PUBLIC_ORIGIN: undefined }, 'apply', flags('--confirm-production'))).toThrow('production configuration is invalid')
  expect(() => productionGuard({ ...production, CMS_LOCAL_BOOTSTRAP: '1' }, 'apply', flags('--confirm-production'))).toThrow('production configuration is invalid')
  expect(failureLine(new Error('The database is a production target (CMS_PUBLIC_DEPLOYMENT=1). Pass --confirm-production only for an approved, backed-up production run.'))).toContain('--confirm-production')
  // The flag is accepted only where it means something.
  expect(parseArgs(['apply', '--plan', '/p.json', '--confirm-production']).flags.has('--confirm-production')).toBe(true)
  expect(parseArgs(['rollback', '--run', 'x', '--confirm-production']).flags.has('--confirm-production')).toBe(true)
  for (const argv of [['dry-run', '--plan', '/p.json', '--confirm-production'], ['publish', '--plan', '/p.json', '--dry-run', '--confirm-production']]) expect(() => parseArgs(argv)).toThrow('Usage')
  // A relative plan path is refused (the packaged command runs from its release directory, where it would mean something else).
  expect(() => readPlan('wp-import-plan.json')).toThrow('plan-file-relative')
  expect(failureLine(new Error('plan-file-relative'))).toBe('Give the plan file as an absolute path.')
})

test('the production guard refuses through the command line before any database is opened', () => {
  copyFileSync(fixture, plan)
  chmodSync(plan, 0o600)
  const env = Object.fromEntries(Object.entries({ ...process.env, ...productionEnv(), CMS_LOCAL_BOOTSTRAP: undefined, CMS_BOOTSTRAP_EMAIL: undefined, CMS_BOOTSTRAP_PASSWORD: undefined, DATABASE_URI: 'postgresql://db.example.invalid/terrace_cms' }).filter(([, value]) => value !== undefined)) as Record<string, string>
  const result = Bun.spawnSync(['bun', 'tools/wp-import.ts', 'apply', '--plan', plan, '--allow-nonlocal-database'], { cwd: cms, env, stdout: 'pipe', stderr: 'pipe' })
  expect(result.exitCode).toBe(1)
  expect(result.stdout.toString()).toBe('')
  expect(result.stderr.toString().trim()).toBe('The database is a production target (CMS_PUBLIC_DEPLOYMENT=1). Pass --confirm-production only for an approved, backed-up production run.')
}, 30_000)
