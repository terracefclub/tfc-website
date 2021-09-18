import { queryElement } from '../../../common/utilities/query';

/**
 * A component loader for the "other menus" area of the 'menus' page to allow
 * for quickly navigating to nearby menus
 */
export default function otherMenusBoxLoader(): void {
  const menusForwardBtn = queryElement(
    document,
    '#menus-forward',
    HTMLButtonElement,
  );
  const menusBackwardBtn = queryElement(
    document,
    '#menus-backward',
    HTMLButtonElement,
  );
  const menusBox = queryElement(document, '#other-menus-box', HTMLDivElement);
  const url = '/menus/others/';

  /**
   * Load the next page of weekly menus by seeking either forward or backward
   * @param direction - whether seeking proceeds backwards or forwards
   */
  async function seekMenus(direction: 'forward' | 'backward'): Promise<void> {
    const isForward = direction === 'forward';
    const edgeSelector = isForward ? 'a:first-child' : 'a:last-child';
    const furthestAttr = isForward ? 'data-isnewest' : 'data-isoldest';

    const furthestMenu = menusBox.querySelector(edgeSelector);
    const isFurthest = furthestMenu?.hasAttribute(furthestAttr);

    if (!isFurthest) return;

    const href = furthestMenu?.getAttribute('href');
    const startDate = href?.match(/\d{4}-\d{2}-\d{2}/);

    if (!startDate) return;

    const { loadHtml } = await import('../../../common/utilities/api');
    const params = new URLSearchParams({ start_date: startDate[0], direction });

    try {
      await loadHtml(menusBox, `${url}?${params}`);
      console.log('Menus loaded!');
    } catch (error) {
      console.error(error);
    }
  }

  menusForwardBtn.addEventListener('click', () => seekMenus('forward'));
  menusBackwardBtn.addEventListener('click', () => seekMenus('backward'));
}
