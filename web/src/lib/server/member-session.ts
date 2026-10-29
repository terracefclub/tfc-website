import { randomBytes } from 'node:crypto';

export class ExpiringStore<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  constructor(private ttlMs: number, private limit = 10_000, private now = Date.now) {}
  put(value: T): string {
    this.prune();
    if (this.entries.size >= this.limit) throw new Error('Sign-in is busy. Try again later.');
    const id = randomBytes(32).toString('base64url');
    this.entries.set(id, { value, expires: this.now() + this.ttlMs });
    return id;
  }
  get(id: string | undefined): T | undefined {
    if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return undefined;
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) { this.entries.delete(id); return undefined; }
    return entry.value;
  }
  take(id: string | undefined): T | undefined { const value = this.get(id); if (id) this.entries.delete(id); return value; }
  delete(id: string | undefined) { if (id) this.entries.delete(id); }
  private prune() { for (const [id, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(id); }
}

export function safeMemberReturn(value: string | null, origin: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/members/';
  const url = new URL(value, origin);
  if (url.origin !== origin || (url.pathname !== '/members' && !url.pathname.startsWith('/members/'))) return '/members/';
  return `${url.pathname}${url.search}${url.hash}`;
}
