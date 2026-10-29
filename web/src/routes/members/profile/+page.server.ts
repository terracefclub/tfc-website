import type { Actions, PageServerLoad } from './$types';
import { change, field, formFailure, list, type Profile } from '$lib/server/community';

const ownProfile = (locals: App.Locals) => list<Profile>(locals, 'member-profiles', { 'where[member][equals]': String(locals.member!.id), limit: '1' });
export const load: PageServerLoad = async ({ locals }) => ({ profile: (await ownProfile(locals)).docs[0] ?? null });

export const actions: Actions = {
  default: async ({ request, locals }) => {
    try {
      const form = await request.formData();
      const classYearText = field(form, 'classYear', 4, false);
      const classYear = classYearText ? Number(classYearText) : null;
      if (classYear !== null && (!Number.isInteger(classYear) || classYear < 1904 || classYear > 2200)) throw new Error('Invalid year.');
      const data = { displayName: field(form, 'displayName', 100), classYear, bio: field(form, 'bio', 2000, false), interests: field(form, 'interests', 300, false), directoryVisible: form.get('directoryVisible') === 'on' };
      const existing = (await ownProfile(locals)).docs[0];
      await change(locals, 'member-profiles', existing ? 'PATCH' : 'POST', data, existing?.id);
      return { success: 'Profile saved. You control whether it appears in the member directory.' };
    } catch (error) { return formFailure(error); }
  },
};
