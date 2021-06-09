// api.ts
/**
 * Utility functions for interfacing with server API. Uses the fetch API
 * provided by the `isomorphic-fetch` package for better browser support.
 * @module
 */

import 'isomorphic-fetch';

/**
 * Helper adapter to server API to handle asynchronous loading of HTML from
 * `TemplateResponse` and `render` views.
 * @param container the element to load HTML into
 * @param fullUrl the url with query parameters to send a GET request to
 * @returns the response, which is primarily processed when rejected for 
 * error message display
 */
export async function loadHtml(
  container: HTMLElement, fullUrl: string
): Promise<Response> {
  const init = {
    method: 'get',
    headers: {
      'Accept': 'text/html',
      'Content-Type': 'text/html',
    },
  };

  const response = await fetch(fullUrl, init);
  if (response.ok) {
    container.innerHTML = await response.text();
    return response;
  } else {
    return Promise.reject(response);
  }
}
