import { isAbsolute } from 'node:path'
import { appEnvKeys, lifecycleKeys } from '../../identity/tools/app-env-keys'

const known: ReadonlySet<string> = new Set(appEnvKeys)
const lifecycle: ReadonlySet<string> = new Set(lifecycleKeys)

/**
 * Parse the identity bootstrap's private settings file for the release proof. Only the keys the
 * bootstrap writes (identity/tools/app-env-keys.ts) are accepted, each exactly once and non-empty;
 * anything else, a missing key or a malformed line throws. The local-preview lifecycle keys are
 * validated and then dropped, because the proof sets its own. Errors never carry a value or a line.
 */
export function parseIdentityEnv(text: string): Record<string, string> {
  const values = new Map<string, string>()
  for (const line of text.trim().split('\n')) {
    const split = line.indexOf('=')
    const key = split < 1 ? '' : line.slice(0, split)
    if (!known.has(key) || values.has(key) || split === line.length - 1) throw new Error('Identity settings file is malformed.')
    values.set(key, line.slice(split + 1))
  }
  if (values.size !== known.size) throw new Error('Identity settings file is incomplete.')
  try {
    const value = values.get('LIFECYCLE_PUBLIC_ORIGIN')!
    const origin = new URL(value)
    if (origin.protocol !== 'http:' && origin.protocol !== 'https:') throw new Error()
    // A bare origin, as the CMS's own validator requires: no path (not even a trailing slash), query, fragment or credentials.
    if (origin.origin !== value) throw new Error()
    if (!isAbsolute(values.get('LIFECYCLE_OUTBOX_DIR')!)) throw new Error()
  } catch { throw new Error('Identity settings file has an invalid lifecycle value.') }
  return Object.fromEntries([...values].filter(([key]) => !lifecycle.has(key)))
}
