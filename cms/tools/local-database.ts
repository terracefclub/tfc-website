/**
 * What the pinned driver does with a connection string (pg 8.20.0 under @payloadcms/db-postgres, which the CMS and both tools connect
 * through; pg 8.16.3 at the top level for tests behaves the same; pg-connection-string 2.14.1; pure JavaScript, pg-native is not installed):
 *  - Every query parameter becomes a config key. pg reads only host, port, user, database, password, options, ssl/sslmode and a few
 *    session settings, each from the config first and from the PG<KEY> environment variable only when the config has none.
 *  - `hostaddr` is parsed and then ignored: pg connects to `host` alone (a TCP host, or the socket file `<host>/.s.PGSQL.<port>` when it
 *    starts with `/`). A comma in `host` is not a host list: it stays one string, so `/tmp,db.example` is a socket path.
 *  - Of the libpq variables only PGHOST can choose where to connect, and only when the string names no host; PGPORT only changes the port.
 *    PGHOSTADDR, PGSERVICE and PGSERVICEFILE are not read (pg has no hostaddr or service key).
 * The classifier fails closed anyway, so a spelling that libpq or another driver would read differently is never called local: `hostaddr`,
 * a comma in any host, a repeated host, any query parameter beyond the ones below, another scheme or an unparseable string is NOT local.
 *
 * The database must be local unless the operator explicitly allows otherwise: a Unix-socket `host=` path or a
 * loopback host. An empty host is NOT local (libpq would fall back to PGHOST), and PGHOST itself must be unset or
 * local. Loopback also admits an SSH tunnel to a remote database, so the flag guards intent, not network topology.
 */
const localParameters = new Set(['host', 'port', 'user', 'password', 'sslmode', 'application_name'])
export function isLocalDatabase(uri: string | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!uri) return false
  const local = (host: string) => !host.includes(',') && (host.startsWith('/') || ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host))
  try {
    const url = new URL(uri)
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') return false
    if ([...url.searchParams.keys()].some((key) => !localParameters.has(key))) return false // hostaddr, service and anything unknown
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
