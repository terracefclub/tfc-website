import { afterAll, beforeAll, expect, test } from 'bun:test'
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OutputRefused } from '../../web/tools/private-output'
import { failureLine, readPlan } from '../tools/wp-import'

// The documented way to try the committed synthetic plan (docs/wordpress-import.md, "Trying the synthetic fixture"): copy it into a private
// directory with mode 0600, then run the CLI from there. Git checks the fixture out as 0644, which the tool rightly refuses.
const cms = join(import.meta.dir, '..')
const fixture = join(import.meta.dir, 'fixtures', 'wp-import-plan.synthetic.json')
const stamp = crypto.randomUUID().slice(0, 6)
const privateDirectory = mkdtempSync(join(tmpdir(), 'terrace-wp-fixture-'))
const plan = join(privateDirectory, 'wp-import-plan.json')
const run = (args: string[]) => {
  const result = Bun.spawnSync(['bun', 'tools/wp-import.ts', ...args], { cwd: cms, env: process.env as Record<string, string>, stdout: 'pipe', stderr: 'pipe' })
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
})
