import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { pool } from './visibility'

/**
 * Run `work` in one transaction that holds a lock keyed on the normalised applicant email. The public intake endpoint and the bulk roster
 * tool both take it around their "is there already an application for this address, then create one" step, so two writers for the same
 * address queue instead of both creating (a transaction-scoped advisory lock: released at commit or rollback, nothing to clean up).
 */
export class LockTimeout extends Error {}
/** How long to wait for the lock: a few seconds, so a stuck holder cannot pile up waiting submissions (each holds a pool connection). */
const lockTimeoutMs = () => { const value = Number(process.env.LIFECYCLE_LOCK_TIMEOUT_MS ?? 3000); return Number.isInteger(value) && value >= 100 && value <= 10_000 ? value : 3000 }

export async function withApplicationLock<T>(payload: Payload, email: string, work: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    const q = pool(payload, req)
    await q.query(`SELECT set_config('lock_timeout', $1, true)`, [`${lockTimeoutMs()}ms`]) // transaction-local
    try { await q.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`terrace-application-email:${email.toLowerCase()}`]) } catch (error) {
      if ((error as { code?: string })?.code === '55P03' || (error as { cause?: { code?: string } })?.cause?.code === '55P03') throw new LockTimeout()
      throw error
    }
    await q.query(`SELECT set_config('lock_timeout', '0', true)`) // the work itself is not bounded by the lock wait
    const result = await work(req)
    await commitTransaction(req)
    return result
  } catch (error) {
    await killTransaction(req).catch(() => undefined)
    throw error
  }
}
