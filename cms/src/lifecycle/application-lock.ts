import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { pool } from './visibility'

/**
 * Run `work` in one transaction that holds a lock keyed on the normalised applicant email. The public intake endpoint and the bulk roster
 * tool both take it around their "is there already an application for this address, then create one" step, so two writers for the same
 * address queue instead of both creating (a transaction-scoped advisory lock: released at commit or rollback, nothing to clean up).
 */
export async function withApplicationLock<T>(payload: Payload, email: string, work: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    await pool(payload, req).query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`terrace-application-email:${email.toLowerCase()}`])
    const result = await work(req)
    await commitTransaction(req)
    return result
  } catch (error) {
    await killTransaction(req).catch(() => undefined)
    throw error
  }
}
