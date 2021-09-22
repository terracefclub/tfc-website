class ShareBtn {
    static selector = '.card-info-footer div:last-child';
    element: HTMLElement;
    url: string | null;
    alert: HTMLDivElement | null | undefined;
    p: HTMLParagraphElement | null | undefined;

    constructor(element: HTMLElement) {
        this.element = element;
        this.url = element.getAttribute('data-url');
        this.alert = element.closest('.card')?.querySelector('.copied-alert');
        this.p = this.alert?.querySelector('p');
    }

    setup(): void {
        this.element.addEventListener('click', async () => {
            const displayMessage = await this.copyUrl();
            this.displayAlert(displayMessage);
        });
    }

    takedown(): void {
        this.element.remove();
        this.alert?.remove();
        this.p?.remove();
    }

    async copyUrl(): Promise<string> {
        if (!this.url) {
            console.error("'data-url' not defined on share button.");
            return 'Copy failed! - Invalid Link';
        }

        try {
            const permission = await navigator.permissions.query({
                name: 'clipboard-write',
            });

            if (permission.state != 'granted' && permission.state != 'prompt') {
                console.error(
                    `PermissionStatus value '${permission.state}' does not support` +
                        "writing to 'navigator.clipboard'",
                );
                return 'Copy failed! - Invalid Clipboard Permissions';
            }

            await navigator.clipboard.writeText(this.url);
        } catch (err) {
            console.error(err);
            return 'Copy failed!';
        }

        return 'Copied!';
    }

    removeAlert(): void {
        this.alert?.classList.add('invisible');
    }

    displayAlert(message: string): void {
        if (this.p) this.p.textContent = message;
        this.alert?.classList.remove('invisible');

        // only display the alert box for 3 seconds
        setTimeout(this.removeAlert, 3000);
    }
}

abstract class _BlogBadge {
    public static parentSelector: string;
    static selector = '.blog-badge';
    private _value: string;
    element: HTMLSpanElement;
    search?: BlogSearch;

    constructor(element: HTMLSpanElement, search?: BlogSearch) {
        this.element = element;
        this.search = search;
        this._value = element.textContent ?? '';
    }

    get value(): string {
        return this._value;
    }

    abstract setup(): void;
}

type BlogBadge = typeof _BlogBadge;

function BlogBadge(mandatory: { parentSelector: string }) {
    // TODO: figure out how to return abstract classes from factory function
    return class extends _BlogBadge {
        static parentSelector = mandatory.parentSelector;
        setup(): void {
            return;
        }
    };
}

class BlogCardBadge extends BlogBadge({ parentSelector: '.card' }) {
    color: string;

    constructor(element: HTMLSpanElement, search?: BlogSearch) {
        super(element, search);
        this.color = element.style.backgroundColor;
    }

    setup(): void {
        this.element.addEventListener('click', () =>
            this.search?.addCardBadge(this),
        );
    }
}

class BlogSearchBadge extends BlogBadge({
    parentSelector: '#blog-search-spans',
}) {
    setup(): void {
        this.element.addEventListener('click', this.remove);
    }

    remove(): void {
        this.element.remove();
        if (this.search) this.search.removeBadge(this);
    }
}

class BlogSearch {
    static typedBadgeColor = 'rgb(156, 163, 175)';
    input: HTMLInputElement;
    box: HTMLDivElement;
    badges: BlogSearchBadge[];

    constructor(input: HTMLInputElement, box: HTMLDivElement) {
        this.input = input;
        this.box = box;
        this.badges = [];
    }

    get values() {
        return this.badges.map((badge) => badge.value);
    }

    addBadge(badge: BlogSearchBadge): boolean {
        this.box.appendChild(badge.element);
        return !!this.badges.push(badge);
    }

    addCardBadge(badge: BlogCardBadge): boolean {
        if (badge.value in this.values) return false;
        const searchBadge = this.createSearchBadge(badge.value, badge.color);
        return !!this.addBadge(searchBadge);
    }

    addTypedBadge(): boolean {
        const value = this.input.value.trim();
        if (value in this.values) return false;
        const searchBadge = this.createSearchBadge(
            value,
            BlogSearch.typedBadgeColor,
        );

        // reset search input
        this.input.value = '';

        return !!this.addBadge(searchBadge);
    }

    removeBadge(badge: BlogSearchBadge): void {
        this.badges = this.badges.filter((badge_) => badge_ !== badge);
    }

    createSearchBadge(value: string, color: string): BlogSearchBadge {
        const badge = document.createElement('span');
        badge.classList.add('blog-badge');
        badge.style.backgroundColor = color;
        badge.textContent = value;

        return new BlogSearchBadge(badge, this);
    }

    setup(): void {
        document.addEventListener('keydown', (event) => {
            if (this.input.matches(':focus')) {
                switch (event.key) {
                    case 'Backspace':
                        return this.handleBackspaceKey();
                    case 'Enter':
                        return this.addTypedBadge();
                    default:
                        return;
                }
            }
        });
    }

    handleBackspaceKey(): void {
        if (this.input.value.length <= 0) {
            const lastBadge = this.badges.pop();
            lastBadge?.remove();
        }
    }
}

export default ShareBtn;
