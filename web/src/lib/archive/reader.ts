import pages from './pages.json';
import type { ArchiveIssue } from './content';

export type NewsletterPage = {
  page: number;
  src: string;
  smallSrc: string;
  width: number;
  height: number;
  smallWidth: number;
  text: string;
};

export function pagesForIssue(issue: ArchiveIssue): NewsletterPage[] {
  return pages.filter((page) => page.issueSlug === issue.slug).map(({ page, src, smallSrc, width, height, smallWidth, text }) => ({ page, src, smallSrc, width, height, smallWidth, text }));
}
