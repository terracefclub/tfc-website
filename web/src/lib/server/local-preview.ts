export const previewOrigin = 'http://127.0.0.1:4194';
export const publishedPreviewCookie = 'terrace_published_preview_4194';

export function localCmsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export function previewEditorLink(requestOrigin: string, env: Record<string, string | undefined>) {
  if (requestOrigin !== previewOrigin || env.TERRACE_LOCAL_PREVIEW !== '1' || !env.CMS_ORIGIN) return null;
  const cms = localCmsOrigin(env.CMS_ORIGIN);
  return cms && cms !== requestOrigin ? `${cms}/admin/login` : null;
}
