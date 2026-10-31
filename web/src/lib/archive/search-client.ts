import { createSearchIndex, type SearchIndex, type SearchPayload } from './search';

export const SEARCH_INDEX_URL = '/newsletter/search-index.json';
let loading: Promise<SearchIndex> | undefined;

/** Loads the index once per page session, only when first needed. A failed load can be retried. */
export function loadSearchIndex(fetcher: typeof fetch = fetch): Promise<SearchIndex> {
  loading ??= fetcher(SEARCH_INDEX_URL, { headers: { accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`Search index responded ${response.status}`);
      return response.json() as Promise<SearchPayload>;
    })
    .then(createSearchIndex)
    .catch((error) => { loading = undefined; throw error; });
  return loading;
}
