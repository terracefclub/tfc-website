import { env } from '$env/dynamic/private';
import { renderBody } from '$lib/render-body';
import { contentMode } from './content';
import { sharedRedirectResolver } from './redirects';
import { getRequestEvent } from '$app/server';

/** Server-side render of a stored body: re-sanitized, image policy applied, old-site links mapped through the redirect map. */
export function renderPublishedBody(bodyHtml: string): Promise<string> {
  const live = contentMode(getRequestEvent().locals.localPreview, env) === 'cms' && env.CMS_ORIGIN;
  let mediaOrigin: string | undefined;
  try { mediaOrigin = new URL(env.CMS_PUBLIC_ORIGIN ?? env.CMS_ORIGIN ?? '').origin; } catch { /* no usable media origin: images are dropped */ }
  return renderBody(bodyHtml, {
    mediaOrigin: live ? mediaOrigin : undefined,
    resolveOldPath: live ? path => sharedRedirectResolver(env.CMS_ORIGIN!).destination(path) : undefined
  });
}
