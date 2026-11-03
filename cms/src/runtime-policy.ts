import path from 'node:path'
import { editorialSettings } from './auth/editorial-policy'
import { keycloakConfig } from './auth/keycloak'
import { productionOrigin, productionSecret } from './auth/production-input'
import { mediaDirectory } from './media-directory'

export const runtimeFailure = 'Invalid CMS runtime configuration. Check the documented origin, identity, secret and media settings.'

function issuer(value: unknown): string {
  if (typeof value !== 'string') throw new Error()
  const url = new URL(value)
  const canonical = productionOrigin(url.origin) + '/realms/terrace'
  if (value !== canonical) throw new Error()
  return canonical
}

function inside(root: string, value: string) {
  const relative = path.relative(root, value)
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
}

export function cmsRuntimeOrigin(env = process.env, componentRoot = process.cwd()): string {
  try {
    const value = env.CMS_ORIGIN || 'http://127.0.0.1:3010'
    if (env.CMS_PUBLIC_DEPLOYMENT !== '1') {
      const url = new URL(value)
      if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error()
      return value
    }

    const origin = productionOrigin(value)
    if (Object.keys(env).some(key => key === 'CMS_LOCAL_BOOTSTRAP' || key.startsWith('CMS_BOOTSTRAP_'))) throw new Error()
    const editorial = editorialSettings(env)
    const member = keycloakConfig(env, 'MEMBER_AUTH')
    if (!member || issuer(env.CMS_AUTH_ISSUER) !== issuer(env.MEMBER_AUTH_ISSUER) ||
        editorial.clientId !== 'terrace-cms' || editorial.audience !== 'terrace-editorial' || editorial.introspectionClientId !== 'terrace-editorial' ||
        member.clientId !== 'terrace-web' || member.audience !== 'terrace-community' || member.introspectionClientId !== 'terrace-community') throw new Error()
    const secrets = [env.PAYLOAD_SECRET, env.CMS_AUTH_CLIENT_SECRET, editorial.introspectionSecret, member.introspectionSecret].map(productionSecret)
    if (new Set(secrets).size !== secrets.length) throw new Error()

    const media = mediaDirectory(env)
    const root = path.resolve(componentRoot)
    if (!env.CMS_MEDIA_DIR || env.CMS_MEDIA_DIR !== media || path.resolve(media) !== media || media === path.parse(media).root ||
        /[\x00-\x1f\x7f-\x9f]/.test(media) || inside('/nix/store', media) || inside(root, media) || inside(media, root)) throw new Error()
    return origin
  } catch {
    // URL errors can retain an input property; never rethrow or attach their cause.
    throw new Error(runtimeFailure)
  }
}
