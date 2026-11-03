export class MemberApiError extends Error {
  constructor(public readonly status: number) { super('The member service could not complete this request.'); }
}

export function memberCmsOrigin(): string {
  const value = process.env.CMS_ORIGIN;
  if (!value) throw new MemberApiError(503);
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1'))) throw new MemberApiError(503);
  return url.origin;
}

export async function memberApi<T>(locals: Pick<App.Locals, 'memberAccessToken'>, path: string, init: RequestInit = {}): Promise<T> {
  if (!locals.memberAccessToken) throw new MemberApiError(401);
  const allowed = /^\/api\/(members|member-profiles|member-stories|story-reports|member-groups|group-memberships|mentorship-offers|mentorship-requests)(?:[/?]|$)/;
  if (!allowed.test(path) || /[\\\u0000-\u001f]/.test(path)) throw new MemberApiError(400);
  const url = new URL(path, memberCmsOrigin());
  if (url.origin !== memberCmsOrigin() || !allowed.test(url.pathname)) throw new MemberApiError(400);
  try {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${locals.memberAccessToken}`);
    headers.delete('Cookie');
    if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...init, headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new MemberApiError([400, 401, 403, 404, 409, 422, 429].includes(response.status) ? response.status : 503);
    if (response.status === 204) return undefined as T;
    const reader = response.body?.getReader();
    if (!reader) throw new MemberApiError(503);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024 * 1024) throw new MemberApiError(503);
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (failure) {
    if (failure instanceof MemberApiError) throw failure;
    throw new MemberApiError(503);
  }
}
