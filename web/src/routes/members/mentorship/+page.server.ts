import type { Actions, PageServerLoad } from './$types';
import { change, field, formFailure, idField, list, pageNumber, type MentorRequest, type Offer } from '$lib/server/community';

const ownOffer = (locals: App.Locals) => list<Offer>(locals, 'mentorship-offers', { 'where[member][equals]': String(locals.member!.id), limit: '1' });
export const load: PageServerLoad = async ({ locals, url }) => {
  const [offers, mine, requests] = await Promise.all([
    list<Offer>(locals, 'mentorship-offers', { page: pageNumber(url), 'where[optIn][equals]': 'true' }), ownOffer(locals),
    list<MentorRequest>(locals, 'mentorship-requests', { page: pageNumber(url, 'requestsPage') }),
  ]);
  return { offers, mine: mine.docs[0] ?? null, requests };
};
export const actions: Actions = {
  offer: async ({ locals, request }) => {
    try {
      const form = await request.formData();
      const data = { displayName: field(form, 'displayName', 100), topics: field(form, 'topics', 300, false), about: field(form, 'about', 1500, false), optIn: form.get('optIn') === 'on' };
      const existing = (await ownOffer(locals)).docs[0];
      await change(locals, 'mentorship-offers', existing ? 'PATCH' : 'POST', data, existing?.id);
      return { success: data.optIn ? 'You’re open to mentorship requests. You can turn this off whenever you need.' : 'Your mentorship offer is off. Existing conversations remain in your requests.' };
    } catch (error) { return formFailure(error); }
  },
  request: async ({ locals, request }) => {
    try { const form = await request.formData(); await change(locals, 'mentorship-requests', 'POST', { mentor: idField(form, 'mentor'), message: field(form, 'message', 1500) }); return { success: 'Your request is saved here for that Terran to read. No email was sent.' }; }
    catch (error) { return formFailure(error); }
  },
  respond: async ({ locals, request }) => {
    try { const form = await request.formData(); const status = field(form, 'status', 20); if (!['accepted', 'declined'].includes(status)) throw new Error('Invalid response.'); await change(locals, 'mentorship-requests', 'PATCH', { status, reply: field(form, 'reply', 1500, false) }, idField(form, 'id')); return { success: 'Your response is saved.' }; }
    catch (error) { return formFailure(error); }
  },
  withdraw: async ({ locals, request }) => {
    try { await change(locals, 'mentorship-requests', 'DELETE', undefined, idField(await request.formData(), 'id')); return { success: 'Your request is withdrawn.' }; }
    catch (error) { return formFailure(error); }
  },
};
