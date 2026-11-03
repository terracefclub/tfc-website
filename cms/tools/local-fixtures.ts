import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function localFixtureCredentials(state: string, requiredKeys: readonly string[]): Record<string, string> {
  try {
    const data: unknown = JSON.parse(readFileSync(resolve(state, 'credentials.json'), 'utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    const credentials: Record<string, string> = {}
    for (const key of requiredKeys) {
      const value: unknown = Object.hasOwn(data, key) ? (data as Record<string, unknown>)[key] : undefined
      if (typeof value !== 'string' || !value.length) throw new Error()
      credentials[key] = value
    }
    return credentials
  } catch {
    // Never let filesystem or JSON errors echo credential content or private paths.
    throw new Error('Dedicated local fixture credentials are unavailable or invalid.')
  }
}
