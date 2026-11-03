import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { previewEditorLink } from '$lib/server/local-preview';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ url }) => ({
  editorSignIn: dev ? previewEditorLink(url.origin, env) : null
});
