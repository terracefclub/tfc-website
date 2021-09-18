import { queryElementAll } from '../../../common/utilities/query';

/**
 * Load a carousel with indexing and shifting capabilities for displaying items
 */
export default function (): void {
  const items = document.querySelectorAll('.carousel-item');

  if (items.length <= 0) return;

  const arrows = queryElementAll(
    document,
    '.carousel-arrow-container a',
    HTMLAnchorElement,
  );
  const dots = queryElementAll(document, '.carousel-dot', HTMLDivElement);

  let index = 0;
  /**
   * Choose a carousel item by position relative to current
   * @param n - amount to increment the active carousel item index by
   */
  const shiftCarouselItem = (n: number): void =>
    selectCarouselItem((index += n));

  /**
   * Choose a specific carousel item by absolute index in item array
   * @param n - the index of the item to be shown
   */
  function selectCarouselItem(n: number): void {
    index = n;

    // handles edge-case cycling
    if (n >= items.length) index = 0;
    if (n < 0) index = items.length - 1;

    // wipes 'items' and 'dots' to ground hidden/inactive state
    items.forEach((item) => item.classList.remove('active'));
    dots.forEach((dot) => dot.classList.remove('active'));

    // item and dot at 'index' are shown/activated
    items[index].classList.add('active');
    dots[index].classList.add('active');
  }

  // arrows cause a carousel shift
  arrows.forEach((arrow) =>
    arrow.addEventListener('click', () => {
      const shift = arrow.getAttribute('data-shift') ?? '0';
      shiftCarouselItem(parseInt(shift));
    }),
  );

  // dots allow selecting a specific item
  dots.forEach((dot) =>
    dot.addEventListener('click', () => {
      const newIdx = dot.getAttribute('data-index') ?? index.toString();
      shiftCarouselItem(parseInt(newIdx));
    }),
  );
}
