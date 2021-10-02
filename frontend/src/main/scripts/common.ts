// common.ts
/**
 * Module for common components such as the layout header, sidebar, main search
 * box, etc. that are shared by almost all pages in the application. Separated
 * from more specific components because of the difference in loading logic.
 * @module
 */

import { queryElement, queryElementAll } from '../../common/utilities/query';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { loadHtml } from '../../common/utilities/api';

/**
 * Main sidebar display logic as a component. Controls opening and closing, as
 * well as expanding and contracting sub navigation areas in the navigation menu
 * of the sidebar.
 */
export function sidebar(): void {
    const sidebar = queryElement(document, '#sidebar', HTMLDivElement);
    const sidebarClose = queryElement(
        document,
        '#sidebar-x',
        HTMLButtonElement,
    );
    const sidebarTrigger = queryElement(
        document,
        '#sidebar-trigger',
        HTMLButtonElement,
    );
    const sidebarNavs = queryElementAll(sidebar, '.nav-drop', HTMLSpanElement);

    // sidebar navigation to toggle a link arrow class
    // TODO: toggle display of subnav items!
    sidebarNavs.forEach((nav) =>
        nav.addEventListener('click', () => {
            nav.classList.toggle('arrow-r');
            nav.classList.toggle('arrow-d');
        }),
    );

    sidebarClose.addEventListener(
        'click',
        () => (sidebar.style.visibility = 'hidden'),
    );
    sidebarTrigger.addEventListener('click', (event: MouseEvent) => {
        event.stopImmediatePropagation();

        sidebar.style.visibility = 'visible';

        const clickOutsideListener = (event: MouseEvent) => {
            if (!sidebar.contains(event.target as Node)) {
                sidebar.style.visibility = 'hidden';
                document.removeEventListener('click', clickOutsideListener);
            }
        };

        document.addEventListener('click', clickOutsideListener);
    });
}

/**
 * Main header display logic as a component. Currently just supports opening
 * the donation page when clicking on the grouped donate button. Only necessary
 * because the button is grouped with decorations that interfere with event
 * bubbling.
 */
export function header(): void {
    const donateBtn = document.querySelector('header div.donate');
    donateBtn?.addEventListener('click', () =>
        window.open(donateBtn.getAttribute('href') || undefined),
    );
}

/**
 * Main search bar logic as a component. Uses the main app modal to display
 * results whenever the contents of the search bar change.
 */
async function searchLoader(): Promise<void> {
    const search = queryElement(document, '#search', HTMLInputElement);
    const modal = queryElement(document, '#modal', HTMLDivElement);
    const modalClose = queryElement(document, '#modal-x', HTMLElement);

    /**
     * Reset modal content without removing `modalClose` (e.g. `.slice(1)`)
     */
    function removeModalContent(): void {
        Array.from(modal.childNodes)
            .slice(1)
            .forEach((node) => node.remove());
    }

    // program the modal close button
    modalClose.addEventListener('click', () => {
        modal.style.display = 'hidden';
        removeModalContent();
    });

    fromEvent(search, 'keydown')
        .pipe(debounceTime(1000))
        .subscribe(async () => {
            // display temporary loading element in modal
            const loading = document.createElement('h1');
            loading.innerHTML = 'Loading...';
            if (modalClose.nextElementSibling) {
                modal.insertBefore(loading, modalClose.nextElementSibling);
            } else modal.appendChild(loading);
            modal.style.removeProperty('display');

            const url =
                '/search?' + new URLSearchParams({ query: search.value });
            const content = document.createElement('div');
            content.classList.add('box');

            try {
                await loadHtml(content, url);
                removeModalContent();
                modal.appendChild(content);
            } catch (error) {
                console.error(error);
                loading.remove();
                content.remove();
            }
        });
}
