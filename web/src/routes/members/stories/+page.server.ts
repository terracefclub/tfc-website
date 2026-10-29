import type { Actions, PageServerLoad } from './$types';
import { change, field, formFailure, idField, list, pageNumber, type Group, type Membership, type Story } from '$lib/server/community';

export const load: PageServerLoad = async ({ locals, url }) => {
  const joined = await list<Membership>(locals, 'group-memberships', { limit: '100' });
  const more = joined.hasNextPage ? await list<Membership>(locals, 'group-memberships', { limit: '100', page: '2' }) : null;
  const ids = [...joined.docs, ...(more?.docs ?? [])].map((item) => item.group);
  const groups = ids.length ? (await list<Group>(locals, 'member-groups', { 'where[id][in]': ids.join(','), limit: '100' })).docs : [];
  const chosen = Number(url.searchParams.get('group'));
  const group = groups.find((item) => item.id === chosen) ?? null;
  const stories = await list<Story>(locals, 'member-stories', { page: pageNumber(url), ...(group ? { 'where[group][equals]': String(group.id) } : {}) });
  return { stories, groups, group };
};

function storyData(form: FormData) {
  const audience = field(form, 'audience', 20);
  if (!['community', 'group'].includes(audience)) throw new Error('Invalid audience.');
  return { title: field(form, 'title', 140), body: field(form, 'body', 10000), audience, group: audience === 'group' ? idField(form, 'group') : null };
}
export const actions: Actions = {
  share: async ({ locals, request }) => {
    try { await change(locals, 'member-stories', 'POST', storyData(await request.formData())); return { success: 'Your story is shared.' }; }
    catch (error) { return formFailure(error); }
  },
  edit: async ({ locals, request }) => {
    try { const form = await request.formData(); await change(locals, 'member-stories', 'PATCH', storyData(form), idField(form, 'id')); return { success: 'Your story is updated.' }; }
    catch (error) { return formFailure(error); }
  },
  remove: async ({ locals, request }) => {
    try { await change(locals, 'member-stories', 'DELETE', undefined, idField(await request.formData(), 'id')); return { success: 'Your story is removed.' }; }
    catch (error) { return formFailure(error); }
  },
};
