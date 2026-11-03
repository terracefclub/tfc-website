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

export function productionSecret(value: unknown): string {
  if (typeof value !== 'string' || value.trim() !== value ||
      Buffer.byteLength(value) < 32 || Buffer.byteLength(value) > 4096 || /[\x00-\x1f\x7f-\x9f]/.test(value)) return invalid()
  return value
}
