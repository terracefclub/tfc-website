/**
 * The shape the packaged lifecycle sweep (`bin/sweep`) prints as its single JSON line: counts and outbox
 * row ids only. Shared by the release smoke and the CI test of the sweep entry so the two cannot drift.
 * Throws a value-free error; `forbidden` strings (for example a synthetic address) must not occur anywhere.
 */
export function assertSweepSummary(summary: unknown, expected: { written: number; forbidden?: readonly string[] }): void {
  const fail = (): never => { throw new Error('Lifecycle sweep summary is not in the expected shape.') }
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return fail()
  const s = summary as Record<string, unknown>
  const mirror = s.mirror as Record<string, unknown> | null | undefined
  if (!mirror || typeof mirror !== 'object' || mirror.written !== expected.written || 'skipped' in mirror) fail()
  // A clean run omits `failed` (reconcileMirror adds it only on failure); anything present must be exactly 0.
  if ('failed' in mirror! && mirror!.failed !== 0) fail()
  for (const name of ['unlinkedRedeemedApplications', 'invitationsExpired', 'applicationsWithdrawn', 'offboardedPastGrace', 'moderatedPurged']) {
    const value = s[name]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail()
  }
  const text = JSON.stringify(summary)
  if ((expected.forbidden ?? []).some(value => text.includes(value))) fail()
}
