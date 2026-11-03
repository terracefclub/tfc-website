import { expect, test } from 'bun:test';
import { createServer } from 'node:net';
import { previewEditorLink, previewOrigin } from '../src/lib/server/local-preview';
import { previewEnvironment, requireFreePort } from '../tools/local-preview';

const identity = { MEMBER_AUTH_ISSUER: 'http://127.0.0.1:8186/realms/terrace', MEMBER_AUTH_CLIENT_ID: 'test-client', MEMBER_AUTH_CLIENT_SECRET: 'test-only' };

test('local preview uses fixtures, CMS3040 and its exact callback origin', () => {
  const env = previewEnvironment({ ...identity, CONTENT_SOURCE: 'cms', MEMBER_AUTH_ORIGIN: 'http://127.0.0.1:4176' });
  expect(env.CONTENT_SOURCE).toBe('preview');
  expect(env.CMS_ORIGIN).toBe('http://127.0.0.1:3040');
  expect(env.MEMBER_AUTH_ORIGIN).toBe(previewOrigin);
  expect(previewEditorLink(previewOrigin, env)).toBe('http://127.0.0.1:3040/admin/login');
});

test('editor sign-in appears only on the dedicated preview with a separate local CMS', () => {
  const env = previewEnvironment({ ...identity, CMS_ORIGIN: 'http://127.0.0.1:3032' });
  expect(previewEditorLink(previewOrigin, env)).toBe('http://127.0.0.1:3032/admin/login');
  expect(previewEditorLink(previewOrigin, { ...env, TERRACE_LOCAL_PREVIEW: undefined })).toBeNull();
  for (const origin of ['https://terracefclub.org', 'http://127.0.0.1:4176']) expect(previewEditorLink(origin, env)).toBeNull();
  for (const CMS_ORIGIN of ['', previewOrigin, 'http://user:pass@127.0.0.1:3040', 'https://external.example', 'bad']) {
    expect(previewEditorLink(previewOrigin, { ...env, CMS_ORIGIN })).toBeNull();
  }
});

test('local preview refuses missing identity and unsafe CMS origins', () => {
  expect(() => previewEnvironment({})).toThrow('identity/tools/with-local');
  for (const CMS_ORIGIN of ['https://example.test', 'http://example.test', 'http://u:p@127.0.0.1:3040', 'http://127.0.0.1:3040/admin', 'http://127.0.0.1:3040/?x=1']) {
    expect(() => previewEnvironment({ ...identity, CMS_ORIGIN })).toThrow('loopback origin');
  }
});

test('occupied ports are refused without stopping the listener', async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    await expect(requireFreePort(address.port)).rejects.toThrow('occupied');
    expect(server.listening).toBe(true);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
