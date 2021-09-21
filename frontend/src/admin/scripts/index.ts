import { queryElement, queryElementAll } from '../../common/utilities/query';

const acceptedDocTypes = [
  '.doc',
  '.docx',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

document.addEventListener('DOMContentLoaded', addDocumentUploader);

function addDocumentUploader(): void {
  // guaranteed to exist because of the Wagtail "insert_editor_js"
  const editorForm = queryElement(document, '#page-edit-form', HTMLFormElement);

  // only proceed if on the Weekly Menu Page creation page
  if (
    !!editorForm
      ?.getAttribute('action')
      ?.match(new RegExp('/admin/pages/add/menus/weeklymenupage.*', 'g'))
  ) {
    const header = queryElement(document, 'header .header-title', HTMLElement);
    const fileHTML = `
        <form enctype="multipart/form-data">
            <input type="file" name="menu"
                accept="${acceptedDocTypes.join(',')}" />
        </form>
    `;
    header.innerHTML += fileHTML;
    const uploadInput = queryElement(header, 'input', HTMLInputElement);
    const uploadForm = queryElement(header, 'form', HTMLFormElement);

    const uploadModal = document.createElement('div');
    uploadModal.className = 'upload-modal';
    uploadModal.innerHTML = `
        <div class="upload-modal">
            <div class="upload-modal-header">
                <h1 class="title">Confirm Menu</h1>
                <button class="upload-modal-close">
                    <svg class="icon icon-cross">
                        <use href="#icon-cross"></use>
                    </svg>
                </button>
            </div>
            <div class="upload-modal-body"></div>
        </div>
    `;
    document.body.append(uploadModal);

    const modalBody = queryElement(
      uploadModal,
      'div.upload-modal-body',
      HTMLElement,
    );

    uploadInput.addEventListener('change', handleDocumentUpload);
    async function handleDocumentUpload(): Promise<Response> {
      if (!uploadInput.files) {
        return Promise.reject('No valid FileList on input');
      }

      const response = await fetch('/menus/upload/', {
        method: 'POST',
        credentials: 'include',
        body: new FormData(uploadForm),
      });
      if (response.ok) {
        const data: {
          menus: {
            weekday: string;
            date: Date;
            dishes: {
              course: string;
              tags: string[];
              name: string;
            }[];
            theme?: string;
          }[];
          monday: Date;
        } = await response.json();

        // set the First Day of the Week (Monday) field
        queryElement(
          editorForm,
          '#id_starting_day',
          HTMLInputElement,
        ).value = formatWagtailDate(data.monday);

        // add new widgets for all the menus in data by clicking button
        const menuWidgetAddBtn = queryElement(
          editorForm,
          '#id_menus-ADD',
          HTMLLinkElement,
        );
        [...Array(data.menus.length)].forEach(() => menuWidgetAddBtn.click());
        const menuWidgets = queryElementAll(
          editorForm,
          '#id_menus-FORMS > *',
          HTMLElement,
        );

        menuWidgets.forEach((widget, i) => {
          // set Date of Meal attribute in FoodItem widget
          queryElement(
            widget,
            `#id_menus-${i}-date`,
            HTMLInputElement,
          ).value = formatWagtailDate(data.menus[i].date);

          // add new FoodItem widgets to the full menu widget by clicking +ADD
          const addFoodItemBtn = queryElement(
            widget,
            `#id_menus-${i}-food_items-ADD`,
            HTMLLinkElement,
          );
          [...Array(data.menus[i].dishes.length)].forEach(() =>
            addFoodItemBtn.click(),
          );
        });

        modalBody.innerHTML = '<h1>Loading ... </h1>';
        uploadModal.style.display = 'block';
        return response;
      }
      return Promise.reject(response);
    }
  }
}

function formatWagtailDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  return [
    year,
    (month < 10 ? '0' : '') + month,
    (day < 10 ? '0' : '') + day,
  ].join('-');
}
