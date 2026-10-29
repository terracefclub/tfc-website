export function pageAtReadingLine(pages: ReadonlyArray<{ page: number; bottom: number }>, line: number): number {
  return pages.find((page) => page.bottom > line)?.page ?? pages.at(-1)?.page ?? 1;
}
