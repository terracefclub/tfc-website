import { env } from '$env/dynamic/private';
import { fixtureContent, getEvent } from '$lib/content';
import { ContentUnavailable, createPayloadClient, type ContentDocument, type ContentPage, type PostView } from './payload';
import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

type PreviewState = App.Locals['localPreview'];

export function contentMode(localPreview: PreviewState, settings: Record<string, string | undefined>) {
  return localPreview
    ? (localPreview.published ? 'cms' : 'preview')
    : settings.CONTENT_SOURCE ?? (settings.CMS_ORIGIN ? 'cms' : 'preview');
}

export function contentSource() {
  const { localPreview } = getRequestEvent().locals;
  const mode = contentMode(localPreview, env);
  if (mode === 'preview') return {
    preview: true,
    events: async () => fixtureContent.events,
    event: async (slug: string) => getEvent(slug),
    newsletters: async () => fixtureContent.newsletters,
    initiatives: async () => [],
    // Imported WordPress content has no sample fixtures: the sample site shows the empty states.
    posts: async (_page: number): Promise<ContentPage> => ({ docs: [], page: 1, totalPages: 1 }),
    post: async (_slug: string): Promise<PostView | undefined> => undefined,
    page: async (_slug: string): Promise<ContentDocument | undefined> => undefined
  };
  if (mode !== 'cms' || !env.CMS_ORIGIN) throw new ContentUnavailable();
  return { preview: false, ...createPayloadClient({ origin: env.CMS_ORIGIN, publicOrigin: env.CMS_PUBLIC_ORIGIN }) };
}

export async function publishedContent<T>(get: (source: ReturnType<typeof contentSource>) => Promise<T>) {
  try { return await get(contentSource()); }
  catch { error(503, 'Published content is temporarily unavailable. Please try again shortly.'); }
}
