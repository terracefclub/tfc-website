import { queryElement, queryElementAll } from '../utilities/query';

/**
 * Load in an event detail card with social links when clicking a calendar block
 * @param socialDomains - list of domains to display social link buttons for
 */
export const eventLoader = async ({
  socialDomains = [],
}: {
  socialDomains?: string[];
} = {}): Promise<void> => {
  const eventBlocks = document.querySelectorAll(
    '.multi-day-event, .single-day-event, #highlights-section .event',
  ) as NodeListOf<HTMLElement>;

  if (eventBlocks.length <= 0) return;

  const detailCard = queryElement(document, '#detail-card', HTMLDivElement);
  const socialBlock = queryElement(
    document,
    '#detail-social-container',
    HTMLDivElement,
  );

  const socialParams = new URLSearchParams(socialDomains.map((name) => [name]));

  /**
   * Call server for `TemplateResponse` inside of `detailCard` and `socialBlock`
   * @param block - an event block on calendar to load async info for
   */
  async function loadAjaxSocialView(block: HTMLElement): Promise<void> {
    const pk = block.getAttribute('data-value')?.toString();

    if (!pk) return;

    socialParams.append('pk', pk);
    const detailUrl = '/events/event?' + new URLSearchParams({ pk });
    const socialsUrl = '/events/socials?' + socialParams;

    const { loadHtml } = await import('../utilities/api');

    try {
      Promise.all([
        loadHtml(detailCard, detailUrl),
        loadHtml(socialBlock, socialsUrl),
      ]);
    } catch (error) {
      console.error(error);
    }
  }

  eventBlocks.forEach((block) =>
    block.addEventListener('click', () => loadAjaxSocialView(block)),
  );
};

/**
 * Load in a new calendar, triggering `eventLoader` as well for these changes,
 * when any form button is clicked to increment the year or month
 */
export const calendarLoader = (): void => {
  const calendar = queryElement(document, '#calendar', HTMLDivElement);
  const calButtons = queryElementAll(
    calendar,
    '#calendar-form button',
    HTMLButtonElement,
  );
  const calYear = queryElement(document, '#calendar-year', HTMLInputElement);

  /**
   *
   * @param button - a form button to trigger calendar form input adjustments
   */
  function updateInputs(button: HTMLButtonElement): void {
    // the amount to increment the input value by (stored on element)
    const shift = parseInt(button.getAttribute('data-shift') ?? '0');

    // map id of button element to hidden input element
    const buttonIdToInputId = {
      'month-up': 'calendar-month',
      'month-down': 'calendar-month',
      'year-up': 'calendar-year',
      'year-down': 'calendar-year',
    };
    const isValidKey = (x: string): x is keyof typeof buttonIdToInputId =>
      x in buttonIdToInputId;

    // update hidden input element value by value of `shift`
    const id = button.getAttribute('id') ?? '';
    if (isValidKey(id)) {
      const input = queryElement(
        document,
        `#${buttonIdToInputId[id]}`,
        HTMLInputElement,
      );
      let newVal = parseInt(input.value) + shift;

      // handle increments of `#calendar-year` input when `#calendar-month`
      // is adjusted from January to December or December to January
      if (['month-up', 'month-down'].includes(id)) {
        if (newVal === 0) {
          newVal = 12;
          calYear.value = (parseInt(calYear.value) - 1).toString();
        } else if (newVal === 13) {
          newVal = 1;
          calYear.value = (parseInt(calYear.value) + 1).toString();
        }
      }

      input.value = newVal.toString();
    }
  }

  /**
   * Display the new calendar by serializing the calendar form and loading async
   * @param button - a form button to trigger calendar re-render
   */
  async function renderCalendar(button: HTMLButtonElement): Promise<void> {
    const form = button.closest('form') as HTMLFormElement;
    const url = '/events/filter?' + form.serialize();

    const { loadHtml } = await import('../utilities/api');
    try {
      await loadHtml(calendar, url);
      await eventLoader();
    } catch (error) {
      console.error(error);
    }
  }

  calButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      updateInputs(btn);
      renderCalendar(btn);
    }),
  );
};
