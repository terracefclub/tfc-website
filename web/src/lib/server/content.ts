import { env } from '$env/dynamic/private';
import { fixtureContent, getEvent } from '$lib/content';
import { ContentUnavailable, createPayloadClient } from './payload';
import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

export function contentSource() {
  const { localPreview } = getRequestEvent().locals;
  const mode = localPreview
    ? (localPreview.published ? 'cms' : 'preview')
    : env.CONTENT_SOURCE ?? (env.CMS_ORIGIN ? 'cms' : 'preview');
  if (mode === 'preview') return {
    preview: true,
    events: async () => fixtureContent.events,
    event: async (slug: string) => getEvent(slug),
    newsletters: async () => fixtureContent.newsletters,
    initiatives: async () => []
  };
  if (mode !== 'cms' || !env.CMS_ORIGIN) throw new ContentUnavailable();
  return { preview: false, ...createPayloadClient({ origin: env.CMS_ORIGIN, publicOrigin: env.CMS_PUBLIC_ORIGIN }) };
}

export async function publishedContent<T>(get: (source: ReturnType<typeof contentSource>) => Promise<T>) {
  try { return await get(contentSource()); }
  catch { error(503, 'Published content is temporarily unavailable. Please try again shortly.'); }
}
