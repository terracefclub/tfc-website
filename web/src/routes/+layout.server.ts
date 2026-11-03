import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ localPreview: locals.localPreview });
