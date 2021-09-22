import '../styles/index.scss';
import { queryElement } from '../../common/utilities/query';
import 'isomorphic-fetch';

class UploadForm {
    static acceptedDocTypes = [
        '.doc',
        '.docx',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    parent = document.body;
    form: HTMLFormElement;
    input: HTMLInputElement;

    constructor(parent?: HTMLElement) {
        if (parent) this.parent = parent;
        this.form = document.createElement('form');
        this.form.enctype = 'multipart/form-data';

        this.input = document.createElement('input');
        this.input.type = 'file';
        this.input.name = 'menu';
        this.input.accept = UploadForm.acceptedDocTypes.join(',');
    }

    async submit(): Promise<Response> {
        if (!this.input.files) {
            return Promise.reject('No valid FileList on input');
        }

        const regex = /^menu_(?<date>\d{2}-\d{2}-\d{4})\.\w+$/.compile();
        const filename = this.input.files[0].name;
        if (!regex.test(filename)) {
            return Promise.reject(
                [
                    `File "${filename}" does not have the correct name format`,
                    'for parsing: "menu_MM-DD-YYYY.docx". Remember to pad',
                    'single-digit dates with a leading zero, as in 09-01-2021.',
                ].join(''),
            );
        }

        const date = regex.exec(filename)?.groups?.date;
        if (!date || new Date(date).getDay() !== 0) {
            // is NOT a monday!
            return Promise.reject(
                [
                    `Date ${date} in the uploaded file name is not a Monday.`,
                    "Plase rename the file to the week's Monday.",
                ].join(''),
            );
        }
        const response = await fetch(`/menus/upload/${date}`, {
            method: 'POST',
            credentials: 'include',
            body: new FormData(this.form),
        });

        if (response.ok) return response;
        return Promise.reject(response);
    }

    load(): void {
        this.form.append(this.input); // assemble
        this.parent.append(this.form); // inject
    }
}

type ModalOptions = {
    prefix?: string;
    parent?: HTMLElement;
};
class Modal {
    prefix = 'modal';
    parent = document.body;
    container: HTMLDivElement;
    body: HTMLDivElement;

    constructor({ prefix, parent }: ModalOptions) {
        this.container = document.createElement('div');
        if (prefix) this.prefix = prefix;
        if (parent) this.parent = parent;
        this.container.innerHTML = `
            <div class="${this.prefix}-header">
                <h1 class="title">Confirm Menu</h1>
                <button class="${this.prefix}-close">
                    <svg class="icon icon-cross">
                        <use href="#icon-cross"></use>
                    </svg>
                </button>
            </div>
            <div class="${this.prefix}-body"></div>
        `;
        this.body = queryElement(
            this.container,
            `.${this.prefix}-body`,
            HTMLDivElement,
        );
    }

    load(): void {
        this.parent.append(this.container);
    }

    show(child: HTMLElement | string): void {
        this.container.style.display = 'block';
        this.body.replaceChildren(child);
    }

    unshow(): void {
        this.body.innerHTML = '';
        this.container.style.display = 'hidden';
    }
}

class Loading {
    container: HTMLDivElement;

    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'spinner';
        this.container.innerHTML = `
            <div class="spinner-text">Chilling ... </div>
            <div class="spinner-sector spinner-sector-green"></div>
            <div class="spinner-sector spinner-sector-blue"></div>
            <div class="spinner-sector spinner-sector-purple"></div>
            <div class="spinner-sector spinner-sector-yellow"></div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = new UploadForm(
        queryElement(document, 'aside .inner', HTMLElement),
    );
    const modal = new Modal({ prefix: 'upload-modal' });
    uploadForm.load();
    modal.load();

    uploadForm.input.addEventListener('change', async () => {
        modal.show(new Loading().container);
        try {
            const response = await uploadForm.submit();
            modal.show(await response.text());
        } catch (error) {
            modal.unshow();
            console.error(error);
            alert('Form submission failed! Check console.');
            return Promise.reject();
        }
    });
});
