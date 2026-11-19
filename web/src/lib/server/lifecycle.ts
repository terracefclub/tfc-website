import { memberCmsOrigin } from './member-api';
import { intakeSecret } from './apply-guard';

export class IntakeError extends Error {
  constructor(public readonly status: number) { super('The membership service could not complete this request.'); }
}

/** Server-to-server call to the CMS lifecycle intake. The shared secret never reaches the browser. */
export async function intake<T>(action: 'apply' | 'redeem', body: Record<string, unknown>): Promise<{ status: number; body: T | null }> {
  let secret: string;
  try { secret = intakeSecret(); } catch { throw new IntakeError(503); }
  try {
    const response = await fetch(new URL(`/api/lifecycle/${action}`, memberCmsOrigin()), {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', 'X-Terrace-Intake': secret }, body: JSON.stringify(body),
    });
    const text = await response.text();
    if (text.length > 4096) throw new IntakeError(503);
    if (response.status >= 500 || response.status === 403 || response.status === 401) throw new IntakeError(503);
    return { status: response.status, body: text ? JSON.parse(text) as T : null };
  } catch (failure) {
    throw failure instanceof IntakeError ? failure : new IntakeError(503);
  }
}

export const tokenShape = /^[A-Za-z0-9_-]{43}$/;
