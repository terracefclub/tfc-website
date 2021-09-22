import { queryElement } from '../src/common/utilities/query';
import { shareLoader } from '../src/main/scripts/components/blog';

function mockFunction<T extends common.func>(fn: T): jest.MockedFunction<T> {
    return fn as jest.MockedFunction<T>;
}

describe('Blog Components', () => {
    describe('shareLoader', () => {
        beforeAll(() => {
            document.body.innerHTML = `
        <div class="card">
          <div class="card-info-footer">
            <div></div>
            <div data-url="my://fancy.url/oo00oo"><i></i></div>
          </div>
          <div class="copied-alert">
            <p>text</p>
          </div>
        </div>`;
        });

        beforeEach(() => {
            Object.assign(navigator, {
                clipboard: {
                    writeText: mockFunction(async () => {
                        Promise.resolve();
                    }),
                },
            });
        });

        function simulate(): void {
            shareLoader();
            const shareBtn = queryElement(
                document,
                '.card-info-footer div:last-child',
                HTMLElement,
            );
            shareBtn.click();
        }

        test.skip('should display failed alert if invalid clipboard permissions', () => {
            Object.assign(navigator, {
                permissions: {
                    query: jest.fn(async () => ({ state: 'denied' })),
                },
            });

            simulate();

            const p = queryElement(document, 'p', HTMLParagraphElement);
            expect(p.textContent).toBe(
                'Copy failed! - Invalid Clipboard Permissions',
            );
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
        });

        test.skip('should display successful copy alert and copy url to clipboard', () => {
            Object.assign(navigator, {
                permissions: {
                    query: jest.fn(async () => ({ state: 'granted' })),
                },
            });

            simulate();

            const p = queryElement(document, 'p', HTMLParagraphElement);
            const url = 'my://fancy.url/oo00oo';
            expect(p.textContent).toBe('Copied!');
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url);
        });

        test.skip('should display failed copy alert if failed to write to clipboard', () => {
            Object.assign(navigator, {
                permissions: {
                    query: jest.fn(async () => ({ state: 'granted' })),
                },
                clipboard: { writeText: jest.fn(() => Promise.reject<void>()) },
            });

            simulate();

            const p = queryElement(document, 'p', HTMLParagraphElement);
            expect(p.textContent).toBe('Copy failed!');
            expect(navigator.clipboard.writeText).not.toHaveReturned();
        });

        test.skip('should display failed alert if no page url is specified on button', () => {
            Object.assign(navigator, {
                permissions: {
                    query: jest.fn(async () => ({ state: 'granted' })),
                },
            });

            const shareBtn = queryElement(
                document,
                '.card-info-footer div:last-child',
                HTMLElement,
            );
            shareBtn.removeAttribute('data-url');
            simulate();

            const p = queryElement(document, 'p', HTMLParagraphElement);
            expect(p.textContent).toBe('Copy failed! - Invalid Link');
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

            // shareBtn.setAttribute('data-url', 'my://fancy.url/oo00oo')
            // if this weren't the last test, to ensure document back to default
            // could refactor as a beforeEach with defaults/resets
        });
    });

    describe('searchLoader', () => {
        test.todo('should add a card badge to search if clicked on card');

        test.todo('should remove a search badge when clicked');

        test.todo(
            'should remove a search badge when hitting backspace in an empty search box',
        );

        test.todo(
            'should add a search badge when hitting enter with a non-empty search box',
        );
    });

    describe('rankedSortAndPaginationLoader', () => {
        // Not sure how to go about testing this really complicated system
        // Probably good to refactor as classes with actual functions
    });
});
