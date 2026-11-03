import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import pg from 'pg'

test('media migration reads scoped database references, resumes safely and hides failure details', async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Integration tests require the isolated local profile.')
  const schema = 'media_copy_' + crypto.randomUUID().replaceAll('-', '')
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URI, max: 1 })
  const root = mkdtempSync(join(tmpdir(), 'terrace-media-cli-'))
  const source = join(root, 'originals'), destination = join(root, 'private')
  mkdirSync(source, { mode: 0o700 })
  const uri = new URL(process.env.DATABASE_URI!)
  uri.searchParams.set('options', '-c search_path=' + schema)
  const run = () => spawnSync(process.execPath, [resolve('tools/migrate-media-directory.ts'), '--from', source], {
    env: { ...process.env, DATABASE_URI: uri.href, CMS_MEDIA_DIR: destination }, encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
  })
  try {
    await pool.query(`create schema ${schema}`)
    await pool.query(`create table ${schema}.media (filename text)`)
    await pool.query(`insert into ${schema}.media values ($1)`, ['synthetic.png'])
    const failure = run()
    expect(failure.status).toBe(1)
    expect(failure.stdout).toBe('')
    expect(failure.stderr).toBe('Media migration incomplete. Originals and verified copies were retained. Check the database, source files and private destination before retrying.\n')
    writeFileSync(join(source, 'synthetic.png'), 'synthetic-bytes')
    const first = run()
    expect(first.status).toBe(0)
    expect(first.stdout).toBe('Media references: 1; copied: 1; already identical: 0. Originals retained.\n')
    const again = run()
    expect(again.status).toBe(0)
    expect(again.stdout).toBe('Media references: 1; copied: 0; already identical: 1. Originals retained.\n')
    expect(readFileSync(join(source, 'synthetic.png'), 'utf8')).toBe('synthetic-bytes')
    expect(readFileSync(join(destination, 'synthetic.png'), 'utf8')).toBe('synthetic-bytes')
  } finally {
    await pool.query(`drop schema if exists ${schema} cascade`)
    await pool.end()
    rmSync(root, { recursive: true, force: true })
  }
}, 45000)
