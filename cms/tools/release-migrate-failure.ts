// The one line a failed release migration leaves behind. Payload's PostgreSQL adapter handles a failing migration itself: it rolls the
// transaction back, calls `payload.logger.error({ err, msg })` and then `process.exit(1)` (@payloadcms/drizzle migrate.js,
// runMigrationFile), so release-migrate's own catch never runs. The logger used to be fully silent, which left the operator with an
// exit status and nothing else. This destination keeps every record silent EXCEPT that one failure, and for it writes a line built
// only from allow-listed parts: the migration name (matched against the known list), the error class, the PostgreSQL SQLSTATE code,
// and the error message only for schema-level codes whose messages name objects, never row values. It never reads `detail`, `where`,
// `query`, `parameters`, `stack`, connection settings or environment values.
import { writeSync } from 'node:fs'

// SQLSTATE codes whose server messages carry object names only (relation/column/constraint "already exists", "does not exist",
// "violates not-null constraint"), never data. Row values live in `detail`, which is never read. Any other code (22P02 and
// friends echo the offending value, 28P01 names the role, connection errors name hosts) gets a fixed sentence.
// 42601 (syntax error) is excluded: its message echoes the SQL token at the error, which a data migration could make a literal.
const MESSAGE_CODES = /^(?!42601$)(42[0-9A-Z]{3}|23502|23503|23505|23514)$/
const MAX_MESSAGE = 200

export type MigrationFailure = { migration: string; errorClass: string; code?: string; message?: string }

const printable = (text: string) => text.replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim()
const word = (value: unknown, fallback: string) => typeof value === 'string' && /^[A-Za-z0-9_.$-]{1,64}$/.test(value) ? value : fallback

type Redacted = { type: string; code?: string; message?: string }
const sqlState = (value: unknown) => typeof value === 'string' && /^[0-9A-Z]{5}$/.test(value) ? value : undefined

/**
 * The pino `err` serializer: it sees the raw error, so redaction happens before anything is serialised. Drizzle wraps the driver error
 * in a DrizzleQueryError whose own message is `Failed query: <SQL> params: <values>`; the PostgreSQL error is its `cause` and carries
 * the SQLSTATE. Walk the cause chain to the first error with a code and report only its class, its code and, for schema-level codes,
 * its message. With no code anywhere only the outermost class is reported. Pure.
 */
export function redactError(err: unknown): Redacted {
  // Reading a hostile error (throwing getter, Proxy) must not throw inside the adapter's catch, or its process.exit(1) is skipped.
  try { return reduceError(err) } catch { return { type: 'Error' } }
}
function reduceError(err: unknown): Redacted {
  let current: unknown = err
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    const code = sqlState((current as { code?: unknown }).code)
    if (code) {
      const out: Redacted = { type: word((current as { constructor?: { name?: unknown } }).constructor?.name, 'Error'), code }
      const message = (current as { message?: unknown }).message
      if (MESSAGE_CODES.test(code) && typeof message === 'string') {
        const text = printable(message).replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[url]').slice(0, MAX_MESSAGE)
        if (text) out.message = text
      }
      return out
    }
    current = (current as { cause?: unknown }).cause
  }
  return { type: word((err as { constructor?: { name?: unknown } } | null)?.constructor?.name, 'Error') }
}

/** Reduce a Payload log record (its `err` already passed through redactError) to the failure, or null when it is not a migration failure. Pure. */
export function failureOf(record: unknown, knownMigrations: readonly string[]): MigrationFailure | null {
  if (typeof record !== 'object' || record === null) return null
  const { msg, err } = record as { msg?: unknown; err?: Redacted }
  if (typeof msg !== 'string') return null
  const prefix = 'Error running migration '
  if (!msg.startsWith(prefix)) return null
  const rest = msg.slice(prefix.length)
  // Longest known name that starts the rest of the message; the rest (which carries the raw error text) is never echoed.
  const known = knownMigrations.filter(name => rest === name || rest.startsWith(name + ' ')).sort((a, b) => b.length - a.length)[0]
  const failure: MigrationFailure = { migration: known ?? 'unknown', errorClass: word(err?.type, 'Error') }
  if (sqlState(err?.code)) failure.code = err!.code
  if (typeof err?.message === 'string' && failure.code && MESSAGE_CODES.test(failure.code)) failure.message = printable(err.message).slice(0, MAX_MESSAGE)
  return failure
}

export function failureLine({ migration, errorClass, code, message }: MigrationFailure): string {
  const reason = message ?? 'details suppressed; inspect the protected runtime configuration and database state'
  return `CMS release migration ${migration} failed (${errorClass}${code ? ` ${code}` : ''}): ${reason}.\n`
}

/** Write all of `text` to a file descriptor before returning. A momentarily full non-blocking pipe (EAGAIN) is retried, sleeping 5 ms between tries, until a wall-clock deadline; it can neither hang forever nor drop the line early. */
export function writeAllSync(fd: number, text: string, deadlineMs = 5000, write: (fd: number, buffer: Buffer, offset: number) => number = (f, b, o) => writeSync(f, b, o)): void {
  const buffer = Buffer.from(text), until = Date.now() + deadlineMs, pause = new Int32Array(new SharedArrayBuffer(4))
  let offset = 0
  while (offset < buffer.length) {
    try { offset += write(fd, buffer, offset) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EAGAIN' || Date.now() >= until) return
      Atomics.wait(pause, 0, 0, 5)
    }
  }
}

/** A pino destination: parses each record it is given (pino's level filter has already dropped everything below error) and writes the failure line synchronously to stderr. */
export function failureDestination(knownMigrations: readonly string[], fd = 2) {
  return {
    write(line: string) {
      let record: unknown
      try { record = JSON.parse(line) } catch { return }
      const failure = failureOf(record, knownMigrations)
      if (failure) writeAllSync(fd, failureLine(failure))
    },
  }
}

/** The logger release-migrate gives Payload: silent below error level, and for an error record only the failure line above. `pino` is passed in because the entrypoint loads it dynamically. */
export function releaseLoggerOptions(knownMigrations: readonly string[]) {
  return [{ level: 'error', serializers: { err: redactError } }, failureDestination(knownMigrations)] as const
}
