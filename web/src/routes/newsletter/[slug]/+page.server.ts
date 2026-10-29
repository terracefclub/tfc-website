import { pagesForIssue } from '$lib/archive/reader';
import { error } from '@sveltejs/kit';
import { issueBySlug, storiesForIssue } from '$lib/archive/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const issue = issueBySlug(params.slug);
  if (!issue) error(404, 'Issue not found');
  return { issue, pages: pagesForIssue(issue), stories: storiesForIssue(issue.slug) };
};
