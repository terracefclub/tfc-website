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

/**
 * Shared by the roster tool and the importer, so both decide "production" the same way: the CMS is a public deployment (exactly
 * `CMS_PUBLIC_DEPLOYMENT=1`, as the CMS runtime reads it), or the database is not local. Another spelling of the variable never turns on
 * the public profile, but a database that is not local is a production target whatever the variable says.
 */
export function productionTarget(env: Record<string, string | undefined> = process.env): { production: boolean; publicDeployment: boolean } {
  const publicDeployment = env.CMS_PUBLIC_DEPLOYMENT === '1'
  return { production: publicDeployment || !isLocalDatabase(env.DATABASE_URI, env), publicDeployment }
}
