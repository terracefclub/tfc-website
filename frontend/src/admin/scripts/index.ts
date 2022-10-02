import '../styles/index.scss';
import { queryElement } from '../../common/utilities/query';
import 'isomorphic-fetch';
import Cookies from 'js-cookie';

class UploadForm {
    static acceptedDocTypes = [
        '.doc',
        '.docx',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    form: HTMLFormElement;
    input: HTMLInputElement;
    button: HTMLButtonElement;

    constructor() {
        this.form = document.createElement('form');
        this.form.enctype = 'multipart/form-data';
        this.form.method = 'POST';

        this.input = document.createElement('input');
        this.input.type = 'file';
        this.input.name = 'menu';
        this.input.accept = UploadForm.acceptedDocTypes.join(',');

        this.button = document.createElement('button');
        this.button.textContent = 'Submit';

        this.form.append(this.input, this.button);
    }

    async submit(): Promise<Response> {
        if (!this.input.files) {
            return Promise.reject('No valid FileList on input');
        }

        const regex = /^menu_(\d{2})-(\d{2})-(\d{4})\.\w+$/;
        const filename = this.input.files[0].name;
        const match = filename.match(regex);
        if (!match) {
            return Promise.reject(
                [
                    `File "${filename}" does not have the correct name format`,
                    'for parsing: "menu_MM-DD-YYYY.docx". Remember to pad',
                    'single-digit dates with a leading zero, as in 09-01-2021.',
                ].join(' '),
            );
        }

        const [month, day, year] = match.slice(1).map((a) => parseInt(a));
        const date = new Date(year, month - 1, day);

        if (date.getDay() !== 1) {
            // is NOT a monday!
            return Promise.reject(
                [
                    `Date "${date}" in the uploaded file name is not a Monday.`,
                    "Please rename the file to the week's Monday.",
                ].join(' '),
            );
        }

        const reformattedDate = [
            month < 10 ? `0${month}` : month,
            day < 10 ? `0${day}` : day,
            year,
        ].join('-');
        const csrftoken = Cookies.get('csrftoken');
        if (!csrftoken)
            return Promise.reject(new Response('csrftoken not defined!'));
        const response = await fetch(`/menus/upload/${reformattedDate}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrftoken,
            },
            credentials: 'same-origin',
            body: new FormData(this.form),
        });

        if (response.ok) return response;
        return Promise.reject(response);
    }
}

type ModalOptions = {
    prefix?: string;
    parent?: HTMLElement;
};
class Modal {
    prefix = 'flab-modal';
    parent = document.body;
    container: HTMLDivElement;
    body: HTMLDivElement;

    constructor({ prefix, parent }: ModalOptions = {}) {
        this.container = document.createElement('div');
        if (prefix) this.prefix = prefix;
        if (parent) this.parent = parent;
        this.container.id = this.prefix;
        this.container.innerHTML = `
            <div id="${this.prefix}-body">
                <div id="${this.prefix}-header">
                    <h1>Modal</h1>
                </div>
            </div>
        `;
        this.body = queryElement(
            this.container,
            `#${this.prefix}-body`,
            HTMLDivElement,
        );

        // add to DOM
        this.parent.append(this.container);
    }

    show(child: HTMLElement | string): void {
        this.container.style.display = 'flex';
        this.body.append(child);
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
    const modalTriggers = document.querySelectorAll('[data-modal]');

    // silently exit if no modal triggers
    if (modalTriggers.length === 0) return;

    const modal = new Modal();
    modalTriggers.forEach((modalTrigger) => {
        modalTrigger.addEventListener('click', () => {
            const modalId = modalTrigger.getAttribute('data-modal');
            if (modalId === 'menu-upload') {
                const uploadForm = new UploadForm();
                modal.show(uploadForm.form);

                uploadForm.button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    modal.show(new Loading().container);
                    try {
                        const response = await uploadForm.submit();
                        window.location.href = response.url;
                    } catch (error) {
                        modal.unshow();
                        console.error(error);
                        alert('Failed to upload resource: ' + error);
                        return Promise.reject();
                    }
                });
            }
        });
    });
});
