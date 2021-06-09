import "../styles/index.scss";

// included to prevent caching of jQuery `load` and `ajax` calls
$.ajaxSetup({ cache: false });

function profileEditLoader(): void {
  const modal = $('#form-modal');
  const modalClose = $('#form-modal-close');
  const modalForm = $('#form-modal-content-form');
  const avatarBtns = $('#profile-summary-avatar-edit button');
  const summaryEditBtns = $('#profile-summary-details button');
  const editBioBtn = $('#bio-edit');
  const bio = $('#profile-bio');


  /**
   * Callback on loading '/avatar/change' to show different css when radio
   * buttons are clicked
   */
  function avatarRadioLabelsSetup(): void {
    const radios = $('input[type="radio"]', modalForm);
    const labels = radios.map(function(){
      return $('label[for="' + this.id + '"]');
    }).get()
      .reduce((all, curr) => $(all).add(curr));
  
    labels.on('click', function(){
      labels.css({ borderColor: '#000', opacity: 0.5 });
      $(this).css({ borderColor: 'rgb(5, 150, 105)', opacity: 1 });
    });
  }
  
  /**
   * Callback on loading '/avatar/delete' to show different css when
   * checkboxes are clicked
   */
  function avatarCheckboxesSetup(): void {
    const checks = $('#form-modal-content-form ul input[type="checkbox"]');
    checks.on('change', function(){
      $(this).parent().toggleClass('selected');
    });
  }

  /**
   * Process the display logic of avatar edit/add/delete forms on the page modal
   * @param this - the avatar edit button clicked
   */
  function handleAvatarEdits(this: HTMLElement): void {
    const idx = avatarBtns.index($(this));
    const idxToEndpoint: Map<number, { url: string, callback?: () => void }> = new Map([
      [0, { url: '/avatar/change', callback: avatarRadioLabelsSetup }],
      [1, { url: '/avatar/add' }],
      [2, { url: '/avatar/delete', callback: avatarCheckboxesSetup }]
    ]);
  
    const { url, callback } = idxToEndpoint.get(idx) ?? {};
    if (url) {
      modalForm.load(url, callback); 
      modal.css('display', 'flex');
    }
  }

  /**
   * Process the display logic of profile field edit forms on the page modal
   * @param this - the profile summary edit button clicked
   */
  function handleSummaryEdits(this: HTMLElement): void {
    const key = $(this).siblings().eq(0).text().toLowerCase().replace(' ', '_');
    if (key !== 'password') {
      modalForm.load(`/flabyrinth/profile/edit/?field=${key}`);
      modal.css('display', 'flex');
    }
  }

  modalClose.on('click', () => modal.css('display', 'none'));
  avatarBtns.on('click', handleAvatarEdits);
  summaryEditBtns.on('click', handleSummaryEdits);
  
  // insert an iframe with the rich text field form to edit a profile's bio
  editBioBtn.on('click', function(){
    bio
      .css({ position: 'relative', height: 650 })
      .html('<iframe seamless class="block absolute" src="/flabyrinth/profile/edit/?field=bio&_=' + Math.floor(Math.random()*1000) + '" frameborder="0" width="100%" height="100%"></iframe>');
  });
}


/**
 * Shows hidden form field elements on signup form when the "Mentor" or "Mentee"
 * options are selected
 */
function signupFormLoader(): void {
  const signupForm = $('form#signup_form');
  const obj = {
    'input#id_mentor': 4,
    'input#id_mentee': 2
  };

  Object.entries(obj).forEach(([id, numFieldsToReveal]) => {
    $(id, signupForm).on('change', function() {
      const display = $(this).is(':checked') ? 'block' : 'none';
      $(this).parent().nextAll().slice(0, numFieldsToReveal).css('display', display);
    });
  });
}

const controller: { 
  [key: string]: (() => void)[]
} = {
  signup: [signupFormLoader],
  profile: [profileEditLoader],
};

$(() => {
  // FRONTEND CONTROLLER
  const bodyClasses = $('body')[0].classList;
  bodyClasses.forEach(class_ => {
    if (class_ in controller) {
      const componentLoaders = controller[class_];
      componentLoaders.forEach(f => f());
    }
  });
});