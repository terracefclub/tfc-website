import { queryElement, queryElementAll } from '../../../common/utilities/query';

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
        '.multi-day-event, .single-day-event, #highlights-section .event-card-simple',
    ) as NodeListOf<HTMLElement>;

    if (eventBlocks.length <= 0) return;

    const detailCard = queryElement(document, '#detail-card', HTMLDivElement);
    const socialBlock = queryElement(
        document,
        '#detail-social-container',
        HTMLDivElement,
    );

    const socialParams = new URLSearchParams(
        socialDomains.map((name) => [name]),
    );

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

        const { loadHtml } = await import('../../../common/utilities/api');

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
    const eventsModal = queryElement(
        calendar,
        '#calendar-grid-loading-modal',
        HTMLDivElement,
    );

    const calYear = queryElement(calendar, '#calendar-year', HTMLInputElement);
    const calMonth = queryElement(
        calendar,
        '#calendar-month',
        HTMLInputElement,
    );

    calYear.value = calYear.defaultValue;
    calMonth.value = calMonth.defaultValue;

    /**
     * Display the new calendar by serializing the calendar form and loading async
     * @param button - a form button to trigger calendar re-render
     */
    async function renderCalendar(): Promise<void> {
        const form = queryElement(calendar, '#calendar-form', HTMLFormElement);
        const searchQuery = new URLSearchParams([
            ...new FormData(form).entries(),
        ] as string[][]);
        const url = '/events/filter/?' + searchQuery;

        const { loadHtml } = await import('../../../common/utilities/api');

        const timer = setTimeout(() => {
            eventsModal.style.display = 'flex';
        }, 1500);

        try {
            await loadHtml(calendar, url);
            await eventLoader();
        } catch (error) {
            console.error(error);
        } finally {
            if (timer) clearTimeout(timer);
            eventsModal.style.display = 'none';
            calendarLoader();
        }
    }

    const changeYearBtn = queryElement(
        calendar,
        '#year-change',
        HTMLButtonElement,
    );
    const changeYearDrop = queryElement(
        calendar,
        '#year-dropdown',
        HTMLDivElement,
    );
    changeYearBtn.addEventListener('click', (event) => {
        event.stopImmediatePropagation();

        changeYearDrop.classList.toggle('visible');

        if (changeYearDrop.classList.contains('visible')) {
            const clickOutsideListener = () => {
                changeYearDrop.classList.remove('visible');
                document.removeEventListener('click', clickOutsideListener);
            };

            document.addEventListener('click', clickOutsideListener);
        }
    });

    const changeMonthBtn = queryElement(
        calendar,
        '#month-change',
        HTMLButtonElement,
    );
    const changeMonthDrop = queryElement(
        calendar,
        '#month-dropdown',
        HTMLDivElement,
    );
    changeMonthBtn.addEventListener('click', (event) => {
        event.stopImmediatePropagation();

        changeMonthDrop.classList.toggle('visible');

        if (changeMonthDrop.classList.contains('visible')) {
            const clickOutsideListener = () => {
                changeMonthDrop.classList.remove('visible');
                document.removeEventListener('click', clickOutsideListener);
            };

            document.addEventListener('click', clickOutsideListener);
        }
    });

    const changeYearOpts = queryElementAll(
        changeYearDrop,
        '.dropdown__content__item',
        HTMLDivElement,
    );
    changeYearOpts.forEach((btn) =>
        btn.addEventListener('click', async () => {
            const value = btn.getAttribute('data-value');
            if (value) {
                calYear.value = value;
                changeYearDrop.classList.toggle('visible');
                await renderCalendar();
            }
        }),
    );

    const changeMonthOpts = queryElementAll(
        changeMonthDrop,
        '.dropdown__content__item',
        HTMLDivElement,
    );
    changeMonthOpts.forEach((btn) =>
        btn.addEventListener('click', async () => {
            const value = btn.getAttribute('data-value');
            if (value) {
                calMonth.value = value;
                changeMonthDrop.classList.toggle('visible');
                await renderCalendar();
            }
        }),
    );
};
