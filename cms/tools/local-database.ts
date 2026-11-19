/**
 * The database must be local unless the operator explicitly allows otherwise: a Unix-socket `host=` path or a
 * loopback host. An empty host is NOT local (libpq would fall back to PGHOST), and PGHOST itself must be unset or
 * local. Loopback also admits an SSH tunnel to a remote database, so the flag guards intent, not network topology.
 */
export function isLocalDatabase(uri: string | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!uri) return false
  const local = (host: string) => host.startsWith('/') || ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)
  try {
    const url = new URL(uri)
    if (url.searchParams.getAll('host').length > 1) return false // libpq uses the last one; do not guess
    const socket = url.searchParams.get('host')
    if (env.PGHOST && !local(env.PGHOST)) return false
    if (socket !== null) return local(socket)
    return url.hostname !== '' && local(url.hostname)
  } catch { return false }
}
