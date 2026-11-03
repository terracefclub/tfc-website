import { fail } from '@sveltejs/kit';
import { MemberApiError, memberApi } from './member-api';

export interface Page<T> { docs: T[]; page: number; totalPages: number; totalDocs: number; hasNextPage: boolean; hasPrevPage: boolean }
export interface Profile { id: number; member: number; displayName: string; classYear?: number; bio?: string; interests?: string; directoryVisible: boolean }
export interface Story { id: number; author: number; authorName: string; title: string; body: string; audience: 'community' | 'group'; group?: number; createdAt: string }
export interface Group { id: number; owner: number; ownerName: string; name: string; description: string }
export interface Membership { id: number; member: number; group: number }
export interface Offer { id: number; member: number; displayName: string; optIn: boolean; topics?: string; about?: string }
export interface MentorRequest { id: number; requester: number; mentor: number; requesterName: string; mentorName: string; message: string; reply?: string; status: 'pending' | 'accepted' | 'declined' }

const collections = new Set(['member-profiles', 'member-stories', 'story-reports', 'member-groups', 'group-memberships', 'mentorship-offers', 'mentorship-requests']);
export function list<T>(locals: App.Locals, collection: string, query: Record<string, string> = {}) {
  if (!collections.has(collection)) throw new Error('Unknown community collection.');
  const params = new URLSearchParams({ depth: '0', limit: '24', sort: '-createdAt', ...query });
  return memberApi<Page<T>>(locals, `/api/${collection}?${params}`);
}

export function pageNumber(url: URL, name = 'page'): string {
  const value = Number(url.searchParams.get(name) || 1);
  return String(Number.isSafeInteger(value) && value >= 1 && value <= 1000 ? value : 1);
}

export function field(form: FormData, name: string, max: number, required = true): string {
  const value = form.get(name);
  if (value !== null && typeof value !== 'string') throw new Error('Please check the form fields.');
  const text = (value || '').trim();
  if (text.length > max || required && !text) throw new Error(`Please check ${name}.`);
  return text;
}

export function idField(form: FormData, name: string): number {
  const id = Number(field(form, name, 15));
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Please choose a valid item.');
  return id;
}

export async function change(locals: App.Locals, collection: string, method: 'POST' | 'PATCH' | 'DELETE', data?: unknown, id?: number) {
  if (!collections.has(collection) || id !== undefined && (!Number.isSafeInteger(id) || id < 1)) throw new Error('Invalid community request.');
  await memberApi(locals, `/api/${collection}${id ? `/${id}` : ''}`, {
    method, headers: { 'Content-Type': 'application/json' }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
}

export function formFailure(error: unknown) {
  if (error instanceof MemberApiError) {
    const status = error.status;
    const message = status === 429 ? 'A little breather: wait a minute before trying again.'
      : status === 401 ? 'Your sign-in has expired. Sign in again to continue.'
        : status === 403 || status === 404 ? 'You do not have access to change that item.'
          : status >= 500 ? 'The community is temporarily unavailable. Your change was not saved.'
            : 'That change could not be saved. Check the fields and whether you have already joined or sent a request.';
    return fail(status >= 400 && status <= 599 ? status : 400, { error: message });
  }
  return fail(400, { error: 'Please check the fields and try again.' });
}
