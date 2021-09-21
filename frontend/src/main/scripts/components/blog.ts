import { queryElement, queryElementAll } from '../../../common/utilities/query';

/**
 *
 */
export function shareLoader(): void {
  const shareBtns = queryElementAll(
    document,
    '.card-info-footer div:last-child',
    HTMLElement,
  );

  /**
   * Copy the URL on an element to the browser clipboard
   * @param el - the element clicked with a URL stored as an attribute
   * @returns a success/failure message to display to user
   */
  async function copyUrl(el: HTMLElement): Promise<string> {
    try {
      const permission = await navigator.permissions.query({
        // TODO: resolve that the permission goes through with javascript
        // These are the only available types: type PermissionName = "gamepad"
        // | "geolocation" | "notifications" | "persistent-storage" | "push" |
        // "screen-wake-lock"
        name: 'clipboard-write' as PermissionName,
      });
      if (permission.state == 'granted' || permission.state == 'prompt') {
        // write the url stored on the share button to the clipboard
        const url = el.getAttribute('data-url');
        if (!url) {
          throw {
            message: 'Invalid Link',
            error: Error("'data-url' not defined on share button."),
          };
        }
        await navigator.clipboard.writeText(url);
      } else {
        throw {
          message: 'Invalid Clipboard Permissions',
          error: Error(
            `PermissionStatus value '${permission.state}' does not support` +
              "writing to 'navigator.clipboard'",
          ),
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (!!err && err.constructor === Object && 'error' in err) {
        console.error(err.error);
        return `Copy failed! - ${err.message}`;
      }
      console.error(err);
      return 'Copy failed!';
    }

    return 'Copied!';
  }

  /**
   * Pass a message to a box to display an alert for 3 seconds
   * @param el - the element clicked with a URL
   * @param message - the message to display
   */
  function displayAlert(el: HTMLElement, message: string): void {
    const alert = el.closest('.card')?.querySelector('.copied-alert');
    const p = alert?.querySelector('p');
    if (p) p.textContent = message;
    alert?.classList.remove('invisible');

    // only display the alert box for 3 seconds
    setTimeout(() => alert?.classList.add('invisible'), 3000);
  }

  shareBtns.forEach((shareBtn) =>
    shareBtn.addEventListener('click', async () =>
      displayAlert(shareBtn, await copyUrl(shareBtn)),
    ),
  );
}

/**
 *
 */
export function searchLoader(): void {
  const cardBadges = document.querySelectorAll('.card .blog-badge');
  const search = queryElement(document, '#blog-search', HTMLInputElement);
  const searchBadgeBox = queryElement(
    document,
    '#blog-search-spans',
    HTMLDivElement,
  );
  const searchBadges = searchBadgeBox.querySelectorAll('.blog-badge');

  /**
   * Handle making a clicked `cardBadge` a `searchBadge` too
   * @param el - the badge on a card that was clicked to be included in search
   */
  function addSearchBadge(el: HTMLElement): void {
    const searchValues = Array.from(searchBadges).map(
      (el) => el.textContent as string,
    );

    // add the badge to search box if not already there
    if (el.textContent && !searchValues.includes(el.textContent)) {
      const badge = el.cloneNode(true);
      badge.addEventListener('click', () =>
        badge.parentNode?.removeChild(badge),
      );
      searchBadgeBox.appendChild(badge);
    }
  }

  /**
   * Deletes the last badge in the search box only if the search input has
   * a truthy value
   */
  function removeLastSearchBadgeIfEmpty() {
    if (search.value === '') {
      const last = searchBadges?.[searchBadges?.length - 1];
      last?.parentNode?.removeChild(last);
    }
  }

  /**
   * Append a new badge to the search box with the contents of the search box
   */
  function addTypedBadge() {
    const value = search.value;
    const searchValues = Array.from(searchBadges).map(
      (el) => el.textContent as string,
    );
    const typedBadgeColor = 'rgb(156, 163, 175)';

    if (value !== '' && !searchValues.includes(value)) {
      const badge = document.createElement('span');
      badge.classList.add('blog-badge');
      badge.style.backgroundColor = typedBadgeColor;
      badge.textContent = value;

      searchBadgeBox.appendChild(badge);

      // reset search box
      search.value = '';
    }
  }

  Array.from(cardBadges).forEach((badge) =>
    badge.addEventListener('click', () => addSearchBadge(badge as HTMLElement)),
  );
  document.addEventListener('keydown', (event) => {
    if (search.matches(':focus')) {
      switch (event.key) {
        case 'Backspace':
          removeLastSearchBadgeIfEmpty();
          break;
        case 'Enter':
          addTypedBadge();
          break;
      }
    }
  });
}

/**
 * Implement ranked sorting with pagination on the blog index page
 */
export function rankedSortAndPaginationLoader(): void {
  const availableRanks = [0, 1, 2, 3];
  const rankingColors = [
    'rgb(239, 68, 68)',
    'rgb(16, 185, 129)',
    'rgb(139, 92, 246)',
    'rgb(245, 158, 11)',
  ];
  const orderCycle = { unordered: 'asc', asc: 'desc', desc: 'unordered' };
  const isOrderCycleKey = (key: string): key is keyof typeof orderCycle =>
    key in orderCycle;

  const blogContainer = document.querySelector('#blog-list-container');
  const blogSorters = document.querySelectorAll('.blog-sorter');
  const rankBoxes = document.querySelectorAll('.rank-container');
  const rankers = document.querySelectorAll('.sorter-ranker');

  const cards = document.querySelectorAll('.card');
  const pageBtns = document.querySelectorAll('.page-button');
  const pageNumEl = document.getElementById('page-num');
  const pageSize = 8;
  const length = cards.length;
  const currPageIdx = 2;

  const sortCards = Array.prototype.sort.bind(cards);

  /**
   * Display the correct page of results and adjust the pagination controls
   * @param button - the pagination button clicked (first, prev, next, last, ..)
   * @param start - the index of the page's first item
   * @param end - the index of the page's last item
   */
  function paginateResults(
    button: HTMLElement,
    start: number,
    end: number,
  ): void {
    // short circuit disabled buttons
    if (button.classList.contains('disabled')) return;

    // shift button highlight to the clicked button
    pageBtns[currPageIdx].classList.remove('selected');
    button.classList.add('selected');

    // display only the `cards` from index `start` to `end`
    cards.forEach((card) => card.classList.add('hidden'));
    Array.from(cards)
      .slice(start, end)
      .forEach((card) => card.classList.remove('hidden'));

    // display the appropriate page number and shift button highlight back
    if (pageNumEl) {
      pageNumEl.textContent = (Math.floor(start / pageSize) + 1).toString();
    }
    button.classList.remove('selected');
    pageBtns[currPageIdx].classList.add('selected');

    // disable the correct pagination buttons when on the first or last page
    Array.from(pageBtns)
      .slice(0, currPageIdx)
      .forEach((btn) => btn.classList.toggle('disabled', start === 0));
    Array.from(pageBtns)
      .slice(currPageIdx + 1)
      .forEach((btn) =>
        btn.classList.toggle('disabled', length - start < pageSize),
      );
  }

  /**
   * Calculate the indices of the cards to be displayed
   * @param btnIndex - the clicked pagination button
   * @returns the start and ending indices of the next page to be displayed
   */
  function getPageBounds(btnIndex: number): [number, number] {
    const pageNumText = pageNumEl?.textContent;
    if (pageNumText) {
      const pageNum = parseInt(pageNumText);
      switch (btnIndex) {
        // the first page
        case 0:
          return [0, pageSize];
        // the previous page
        case 1:
          return [(pageNum - 2) * pageSize, (pageNum - 1) * pageSize];
        // the current page
        case 2:
          return [(pageNum - 1) * pageSize, pageNum * pageSize];
        // the next page
        case 3:
          return [
            pageNum * pageSize,
            Math.min((pageNum + 1) * pageSize, length),
          ];
        // the last page
        case 4:
          return [length - (length % pageSize), length];
        default:
          return [0, length];
      }
    }
    return [0, length];
  }

  /**
   * Sort the cards by their index when retrieved from server (the post number)
   */
  function defaultSort(): void {
    sortCards((a: HTMLElement, b: HTMLElement) => {
      const vals = [a, b].map((card) =>
        parseInt(card.querySelector('.post-number')?.textContent || '0'),
      );
      return vals[0] - vals[1];
    });
    cards.forEach((card) => card.parentNode?.removeChild(card));
    blogContainer?.append(...Array.from(cards));
  }

  /**
   * Calculates the rank of a particular sorter
   * @param box - the rank box with a potentially selected rank inside
   * @returns the index of the selected `ranker` child (-1 if nothing)
   */
  function getSelectedRank(box: HTMLElement): number {
    const rankerSelected = box.querySelector('.sorter-ranker[data-selected]');
    const rankers = rankerSelected?.parentNode?.childNodes;
    if (!rankers || !rankerSelected) return -1;
    return Array.from(rankers).indexOf(rankerSelected);
  }

  /**
   * Sort the cards by the ranked sorters
   */
  function rankedSort(): void {
    // reset to original sort
    defaultSort();

    // get all active rank sorters in reversed ranking order
    const ranks = Array.from(rankBoxes)
      .map((box) => ({
        boxIdx: Array.from(rankBoxes).indexOf(box),
        rank: getSelectedRank(box as HTMLElement),
        order: box
          .closest('.blog-filter')
          ?.querySelector('.blog-sorter')
          ?.getAttribute('data-sort'),
      }))
      .filter(({ rank }) => rank !== -1)
      .sort((a, b) => b.rank - a.rank);

    // sort the cards for each active ranked sorter
    ranks.forEach(({ boxIdx, order }) => {
      sortCards((a: HTMLElement, b: HTMLElement) => {
        // set values of comparison for sorting by extracting the corresponding
        // value in the card footer (date is the exception because it's displayed
        // separately and requires the use of `Date.parse`)
        let aVal: number, bVal: number;
        if (boxIdx === 3) {
          [aVal, bVal] = [a, b].map((card) =>
            Date.parse(
              card.querySelector('.card-info-header-date')
                ?.textContent as string,
            ),
          );
        } else {
          const valueSelector = `.card-info-footer div:nth-child(${
            boxIdx + 1
          }) p`;
          [aVal, bVal] = [a, b].map((card) =>
            parseInt(
              card.querySelector(valueSelector)?.getAttribute('data-val') ??
                '0',
            ),
          );
        }

        // ascending order reverses the subtraction order for comparison
        if (order === 'asc') return aVal - bVal;
        return bVal - aVal;
      });
    });
    cards.forEach((card) => card.parentNode?.removeChild(card));
    blogContainer?.append(...Array.from(cards));
  }

  /**
   * Adjust the display of ranking buttons and initiate a ranked sort
   * @param ranker - the ranker dot button that initiates sorting
   */
  function handleRankersDisplay(ranker: HTMLElement): void {
    const groupRankers = ranker.parentNode?.childNodes;

    if (!groupRankers) return;

    const oldRank = Array.from(groupRankers)
      .map((ranker_) => (ranker_ as HTMLElement).hasAttribute('data-selected'))
      .indexOf(true);
    const newRank = Array.from(groupRankers).indexOf(ranker);

    // Find the index of the sorter with an already selected 'newRank' ranker
    const otherSorterIdxWithNewRank = Array.from(rankBoxes)
      .map((box) => box.children[newRank].hasAttribute('data-selected'))
      .indexOf(true);
    if (otherSorterIdxWithNewRank !== -1) {
      // Unselect the other 'newRank' ranker
      const otherOldRanker =
        rankBoxes[otherSorterIdxWithNewRank].children[newRank];
      otherOldRanker.removeAttribute('data-selected');
      (otherOldRanker as HTMLElement).style.borderColor = '#fff';

      // Select the other 'oldRank' ranker
      const otherNewRanker =
        rankBoxes[otherSorterIdxWithNewRank].children[oldRank];
      otherNewRanker.setAttribute('data-selected', 'true');
      (otherNewRanker as HTMLElement).style.borderColor =
        rankingColors[oldRank];
    }

    // Select the 'newRank' ranker
    ranker.setAttribute('data-selected', 'true');
    ranker.style.borderColor = rankingColors[newRank];

    // Unselect the 'oldRank' ranker
    const oldRanker = groupRankers[oldRank] as HTMLElement;
    oldRanker.removeAttribute('data-selected');
    oldRanker.style.borderColor = '#fff';

    rankedSort();
  }

  /**
   *
   * @param sorter - the `blogSorter` that was clicked to sort the blog post cards
   */
  function sortHandler(sorter: HTMLElement): void {
    // pressing 'ALL' to reset all sorting and ranking
    const isAllSorter = blogSorters[0] === sorter;
    if (isAllSorter) {
      // reset (NOTE: do we need to specify sorters that are not allSorter?)
      blogSorters.forEach((sorter_) =>
        sorter_.setAttribute('data-sort', 'unordered'),
      );

      // reset the rankers
      rankers.forEach((ranker_) => {
        ranker_.removeAttribute('data-selected');
        (ranker_ as HTMLElement).style.borderColor = '#fff';
      });

      // reset the caret icons indicating sort order
      blogSorters.forEach((sorter_) => {
        const caret = sorter_.getElementsByTagName('i')[0];
        caret.classList.replace('fa-caret-down', 'fa-caret-up');
        caret.style.visibility = 'hidden';
      });

      // hide the boxes of rankers
      rankBoxes.forEach(
        (box) => ((box as HTMLElement).style.visibility = 'hidden'),
      );

      // reset card order and go to first page
      defaultSort();
      paginateResults(pageBtns[0] as HTMLElement, 0, pageSize);

      return;
    }

    const icon = sorter.getElementsByClassName('i')[0] as HTMLElement;
    const container = icon.nextElementSibling as HTMLElement; // .rank-container

    const oldOrder = sorter.getAttribute('data-sort') ?? '';
    if (!isOrderCycleKey(oldOrder)) return;
    const order = orderCycle[oldOrder];

    // ASCENDING ORDER
    if (order === 'asc') {
      // Display caret icon and ranking container
      icon.style.visibility = 'visible';
      container.style.visibility = 'visible';

      // Retrieve next available rank for the sorter and its corresponding 'sorter-ranker'
      const takenRanks = Array.from(rankBoxes)
        .map((box) =>
          Array.from(box.children)
            .map((ranker_) => ranker_.hasAttribute('data-selected'))
            .indexOf(true),
        )
        .filter((idx) => idx !== -1);
      const rank = availableRanks.filter((idx) => !takenRanks.includes(idx))[0];

      // Update ranker visually to reflect the priority of the sorter selected
      const ranker = container.children[rank] as HTMLElement;
      ranker.style.borderColor = rankingColors[rank];
      ranker.setAttribute('data-selected', 'true');

      // DESCENDING ORDER
    } else if (order === 'desc') {
      // Change the caret icon used
      icon.classList.replace('fa-caret-up', 'fa-caret-down');

      // UNORDERED
    } else {
      // Reset the caret icon to 'up' and hide it from view
      icon.classList.replace('fa-caret-down', 'fa-caret-up');
      icon.style.visibility = 'hidden';

      // Hide rankers contaner
      container.style.visibility = 'hidden';

      // Unselect rankers and set them to the default color
      container.childNodes.forEach((ranker_) => {
        (ranker_ as HTMLElement).removeAttribute('data-selected');
        (ranker_ as HTMLElement).style.borderColor = '#fff';
      });
    }

    sorter.setAttribute('data-sort', order);
    rankedSort();

    const pageNum = parseInt(pageNumEl?.textContent as string);
    paginateResults(
      pageBtns[currPageIdx] as HTMLElement,
      (pageNum - 1) * pageSize,
      Math.min(pageNum * pageSize, length),
    );
  }

  pageBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      const btnIndex = Array.from(pageBtns).indexOf(btn);
      paginateResults(btn as HTMLElement, ...getPageBounds(btnIndex));
    }),
  );

  rankers.forEach((ranker) =>
    ranker.addEventListener('click', () =>
      handleRankersDisplay(ranker as HTMLElement),
    ),
  );
  blogSorters.forEach((sorter) =>
    sorter.addEventListener('click', () => sortHandler(sorter as HTMLElement)),
  );
}

/**
 * Load tags and sorting from sessionStorage
$(window).on('load', () => {
  const searchTags = sessionStorage.getItem('searchTags');
  const sorters = sessionStorage.getItem('sorters');

  if (searchTags) {
    const tags = JSON.parse(searchTags);
    const tmpBadge = $(document.createElement('span').attr('class', 'blog-badge rounded-md text-white p-1 cursor-pointer whitespace-nowrap'));
    tags.forEach(({ name, color }) => 
      tmpBadge.clone()
        .html(name)
        .css('background-color', color)
        .appendTo($('#blog-search-spans'))
    );
    tmpBadge.remove();
  }
});
 */

/**
$('.page-button').not('.disabled').on ...
  const searchTags = $('#blog-search-spans .blog-badge').map(function(){
    return {
      name: $(this).text(),
      color: $(this).css('background-color')
    };
  }).get();

  const sorters = $('.blog-filter').slice(1, 5).map(function(){
    return {
      name: $(this).text(),
      sort: $('.blog-sorter', this).attr('data-sort'),
      rank: $('.sorter-ranker', this).index($('[data-selected]', this))
    };
  }).get();

  sessionStorage.setItem('searchTags', JSON.stringify(searchTags));
  sessionStorage.setItem('sorters', JSON.stringify(sorters));
  */
