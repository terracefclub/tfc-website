const invalid = (): never => { throw new Error('Invalid production input.') }

// Shared with the realm generator; these checks have no filesystem or CLI side effects.
export function productionOrigin(value: unknown): string {
  if (typeof value !== 'string') return invalid()
  try {
    const url = new URL(value)
    const labels = url.hostname.split('.')
    if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash || labels.length < 2 || url.hostname.length > 253 ||
        !labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
        !/[a-z]/.test(labels.at(-1)!) || /(?:^|\.)localhost$/.test(url.hostname)) return invalid()
    return value
  } catch { return invalid() }
}

// Names that only resolve inside a private network are never a public origin (single-label hosts and IP literals
// already fail productionOrigin: it needs at least two DNS labels and a final label containing a letter).
const privateSuffix = /(?:^|\.)(?:local|localdomain|internal|intranet|private|lan|corp|home|home\.arpa)$/

/** A bare public https origin: `productionOrigin` plus no private-network or reserved suffix. Shared by CMS runtime policy and lifecycle delivery. */
export function publicOrigin(value: unknown): string {
  const origin = productionOrigin(value)
  if (privateSuffix.test(new URL(origin).hostname)) return invalid()
  return origin
}

export function productionSecret(value: unknown): string {
  if (typeof value !== 'string' || value.trim() !== value ||
      Buffer.byteLength(value) < 32 || Buffer.byteLength(value) > 4096 || /[\x00-\x1f\x7f-\x9f]/.test(value)) return invalid()
  return value
}
