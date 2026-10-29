import type { Actions, PageServerLoad } from './$types';
import { change, field, formFailure, idField, list, pageNumber, type Group, type Membership } from '$lib/server/community';

export const load: PageServerLoad = async ({ locals, url }) => {
  const [groups, memberships] = await Promise.all([
    list<Group>(locals, 'member-groups', { page: pageNumber(url), sort: 'name' }),
    list<Membership>(locals, 'group-memberships', { limit: '100' }),
  ]);
  const more = memberships.hasNextPage ? await list<Membership>(locals, 'group-memberships', { limit: '100', page: '2' }) : null;
  return { groups, memberships: [...memberships.docs, ...(more?.docs ?? [])] };
};
export const actions: Actions = {
  create: async ({ locals, request }) => {
    try { const form = await request.formData(); await change(locals, 'member-groups', 'POST', { name: field(form, 'name', 100), description: field(form, 'description', 2000) }); return { success: 'Your group is open. You are its first member.' }; }
    catch (error) { return formFailure(error); }
  },
  edit: async ({ locals, request }) => {
    try { const form = await request.formData(); await change(locals, 'member-groups', 'PATCH', { name: field(form, 'name', 100), description: field(form, 'description', 2000) }, idField(form, 'group')); return { success: 'Your group is updated.' }; }
    catch (error) { return formFailure(error); }
  },
  join: async ({ locals, request }) => {
    try { await change(locals, 'group-memberships', 'POST', { group: idField(await request.formData(), 'group') }); return { success: 'You joined the group. Its stories are now visible to you.' }; }
    catch (error) { return formFailure(error); }
  },
  leave: async ({ locals, request }) => {
    try { await change(locals, 'group-memberships', 'DELETE', undefined, idField(await request.formData(), 'membership')); return { success: 'You left the group.' }; }
    catch (error) { return formFailure(error); }
  },
};
