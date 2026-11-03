import { resolve } from 'node:path'
import pg from 'pg'
import { mediaDirectory } from '../src/media-directory'
import { copyReferencedMedia } from './copy-media'

let pool: pg.Pool | undefined
try {
  if (process.argv.length !== 4 || process.argv[2] !== '--from' || !process.env.DATABASE_URI) throw new Error()
  const source = resolve(process.argv[3])
  const destination = mediaDirectory()
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URI, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 10000 })
  const result = await pool.query('select filename from media where filename is not null limit 100001')
  if (result.rows.length > 100000 || result.rows.some(row => typeof row.filename !== 'string')) throw new Error()
  const summary = copyReferencedMedia(source, destination, result.rows.map(row => row.filename))
  console.log('Media references: ' + summary.referenced + '; copied: ' + summary.copied + '; already identical: ' + summary.reused + '. Originals retained.')
} catch {
  console.error('Media migration incomplete. Originals and verified copies were retained. Check the database, source files and private destination before retrying.')
  process.exitCode = 1
} finally { await pool?.end() }
