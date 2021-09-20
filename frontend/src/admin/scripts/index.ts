// TODO: NOTE: WHY IN THE FUCK DOES MY UTILITY FUNCTION NOT WORK IN THIS FUCKING
// SCRIPT, NOTHING WORKS IF I TRY TO USE IT?!!?!?!?!?!?!?!?!?!?!?!?
// import { queryElement } from '../../common/utilities/query';
import { loadHtml } from '../../common/utilities/api';

document.addEventListener('DOMContentLoaded', addDocumentUploader);

function addDocumentUploader(): void {
  // guaranteed to exist because of the Wagtail "insert_editor_js"
  const editorForm = document.getElementById('page-edit-form');

  //   only proceed if on the Weekly Menu Page creation page
  if (
    !!editorForm
      ?.getAttribute('action')
      ?.match(new RegExp('/admin/pages/add/menus/weeklymenupage.*', 'g'))
  ) {
    const editPageContentList = editorForm.querySelector(
      '#tab-content > ul.objects',
    );

    const referenceInputLayout = editPageContentList
      ?.querySelector('#id_doc-chooser')
      ?.closest('li.object');

    const newLayout = referenceInputLayout?.cloneNode(true);

    if (!(newLayout instanceof HTMLLIElement)) {
      throw new Error(`FATAL: Object ${newLayout} is not a valid DOM element`);
    }

    const acceptedDocTypes = [
      '.doc',
      '.docx',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const fileInput = document.createElement('input');
    fileInput.id = 'menu-upload';
    fileInput.accept = `${acceptedDocTypes.join(',')}`;
    fileInput.setAttribute('type', 'file'); // no setter for property "type"

    const confirmationModal = document
      .querySelector('div.modal')
      ?.cloneNode(true);
    if (!(confirmationModal instanceof HTMLDivElement)) {
      throw new Error(
        `FATAL: Object ${confirmationModal} is not a valid DOM element`,
      );
    }
    confirmationModal.querySelector('ul.tab-nav')?.remove();
    const modalContent = document.createElement('section');
    modalContent.id = 'confirmation';
    modalContent.classList.add('nice-padding', 'active');
    confirmationModal
      .querySelector('div.tab-content')
      ?.replaceChildren(modalContent);
    fileInput.addEventListener(
      'change',
      async (): Promise<Response> => {
        if (!fileInput.files) {
          return Promise.reject('No valid FileList on input');
        }

        const response = await fetch('/admin/menus/upload', {
          method: 'POST',
          headers: {
            'Content-Type': fileInput.files[0].type,
          },
          body: fileInput.files[0],
        });

        if (response.ok) {
          modalContent.innerHTML = await response.text();
          confirmationModal.style.display = 'block';
          return response;
        }
        return Promise.reject(response);
      },
    );

    newLayout.querySelector('#id_doc-chooser')?.replaceWith(fileInput);

    editPageContentList?.prepend(newLayout);
  }
}
