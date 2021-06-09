import os

TINYMCE_JS_URL = 'https://cdn.tiny.cloud/1/' + \
  os.environ.get("TINYCLOUD_API_KEY", "no-api-key") + \
  '/tinymce/5.6/tinymce.min.js'
TINYMCE_SPELLCHECKER = True  # enable use of default TinyMCE spellchecker
TINYMCE_COMPRESSOR = False   # must be false when using minifed JS from CDN!
TINYMCE_DEFAULT_CONFIG = {

  ########################
  ### GENERAL SETTINGS ###
  ########################

  'menubar': True,                         # top 'File Insert ...' visible
  'draggable_modal': True,                 # dialogs are draggable
  'table_appearance_options': True,        # ensures has all table customization
  'resize': False,                         # no resizing possible
  'statusbar': True,                       # displays bottom status bar

  'plugins': [
    'advlist',    # adds more options to bulleted/numbered lists
    'anchor',     # allows adding anchor/bookmark insertion button (anchor)
    'autolink',   # automatically creates hyperlinks when URL is typed
    'autoresize', # resizes editor to content size
    'autosave',   # warns user of unsaved changes (restoredraft)
    'charmap',    # adds special unicode characters! (charmap)
    'code',       # allows editing the underlying HTML (code)
    'directionality', # supports control direction of text (rtl ltr)
    'emoticons',  # now you can add emoticons too! (emoticons)
    'help',       # adds a help dialog (help) showing shortcuts and how-tos
    'hr',         # adds a horizontal rule (hr)
    'image',      # allows adding images (image)
    'imagetools', # adds a toolbar on image click for adjusting basic attributes

    ### this order ensures 'table' and 'lists' 'Tab' functionality still works
    'table',      # adds table creation, editing, deletion, etc. optinos (table)
    'lists',      # basic support for bulleted/numbered lists (numlist bullist)
    'nonbreaking',# allows adding nonbreaking spaces (nonbreaking)
    ###

    'link',       # adding hyperlinks (link)
    'media',      # adding HTML5 video and audio elements (media)
    'paste',      # pasting content from MSWord with filter/cleanup (paste)
    'preview',    # viewing content in read-only popup
    'print',      # add a print option (save PDF for example) (print)
    'quickbars',  # adds additional quick edit toolbars (selection, insertion, )
    'searchreplace', # to find and replace content easily [like Ctrl-F]
    'spellchecker',  # enables spellchecking (spellchecker)
    'visualblocks',  # visualizes block level (p, etc.) elements (visualblocks)
    'wordcount'   # to see the wordcount in text editor (wordcount)
  ],

  ################
  ### TOOLBARS ###
  ################

  # primary toolbars under menubar
  'toolbar': [
    ' | '.join([
      'forecolor backcolor charmap emoticons',
      'paste pastetext searchreplace',
      'link image anchor',
      'ltr rtl',
      'restoredraft preview print wordcount'
    ]),
  ],
  # toolbar shown when focused on a table
  'table_toolbar': ' | '.join([
    'tableprops tabledelete',
    'tableinsertrowbefore tableinsertrowafter tabledeleterow',
    'tableinsertcolbefore tableinsertcolafter tabledeletecol'
  ]),
  # the default contextmenu
  'contextmenu': 'undo redo | inserttable | cell row column deletetable | help',
  # popup toolbar when clicking on empty line
  'quickbars_insert_toolbar': 'quicktable quickimage media | hr nonbreaking',
  # popup toolbar when selecting text elements in content editor
  'quickbars_selection_toolbar': ' | '.join([
    'bold italic underline',
    'formatselect removeformat',
    'bullist numlist',
    'blockquote quicklink'
  ]),
  # popup toolbar when focused on an image
  'quickbars_image_toolbar': ' | '.join([
    'alignleft aligncenter alignright',
    'rotateleft rotateright',
    'imageoptions'
  ]),

  ################################
  ### PLUGIN SPECIFIC SETTINGS ###
  ################################

  # standard toolbars
  'toolbar_mode': 'scrolling',  # toolbars are scrollable when content cant fit
  'toolbar_sticky': True,       # when scrolling vertically, toolbar sticks

  # lists
  'lists_indent_on_tab': True,  # auto lists on 'Tab'

  # links
  'default_link_target': '_blank',   # autolinked URLs target auto new tab
  'link_default_protocol': 'https',  # for autolinked URLs, best security
  'link_class_list': [               # link types (dropdown) => adds classname
    { 'title': 'External', 'value': 'ext_link' },
    { 'title': 'Internal', 'menu': [
      { 'title': 'Post', 'value': 'int_post_link' },
      { 'title': 'Profile', 'value': 'int_profile_link' },
    ]},
  ],
  'link_context_toolbar': True,       # Shows toolbar for newly added links
  'link_quicklink': True,             # Opens ^ toolbar with [Ctrl-K] shortcut

  # autoresize
  'autoresize_bottom_margin': 50,     # mandates a 50px bottom margin
  'autoresize_on_init': True,         # default resizing when initialized
  'autoresize_overflow_padding': 50,  # sides of editor body set on init
  'max_height': 850,                  # will NOT resize when bigger than this
  'min_height': 150,                  # will never be smaller than this

  # autosave
  'autosave_ask_before_unload': True, # prompts user about unsaved changes
  'autosave_interval': '30s',         # localStorage snapshots taken every 30s
  'autosave_prefix': 'tinymce-autosave-{path}{query}-{id}-',
  'autosave_restore_when_empty': True, # retrieves localStorage automatically
  'autosave_retention': '45m',         # length of time content is saved

  # nonbreaking
  'nonbreaking_force_tab': True,       # 'Tab' hotkey
  'nonbreaking_wrap': True,            # span wrapper for nbsp (for browsers?)

  # paste
  'paste_block_drop': False,           # keeps drag/drop on (no filtering?)
  'paste_data_images': True,           # keeps inline data:url on paste 
                                       # may slow loads and prevent caching
  'paste_as_text': True,               # enables Paste As Text toolbar item
  'paste_enable_default_filters': True, # keeps default TinyMCE filters
  'paste_filter_drop': True,           # keeps drop pasting filters
  'paste_webkit_styles': 'none',       # preserves no styles from webkit
  'paste_retain_style_properties': 'all',  # preserves MS Word CSS style names
  'paste_merge_formats': True,             # simplifies HTML by merging repeats
  'paste_tab_spaces': 4,                   # on paste, 'Tab' is 4 spaces
  'paste_convert_word_fake_lists': True,   # creates list from paragraphs
  'paste_remove_styles_if_webkit': True,   # removes any webkit style (???)
  'smart_paste': True,                     # autodetects URLs & images on paste
  'image_file_types': 'jpeg,jpg,png,gif,bmp,webp',  # accepted image formats

  # blockformats/formatselect
  'block_formats': '; '.join([
    'Paragraph=p', 'Heading 1=h1', 'Heading 2=h2', 'Heading 3=h3',
    'Heading 4=h4', 'Heading 5=h5', 'Heading 6=h6', 'Preformatted=pre'
  ]),

  # fontsizeselect/fontsizes
  'fontsize_formats': '8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt',

  # charmap
  'charmap_append': [ # for adding special characters
    [0x2600, 'sun'],
    [0x2615, 'morning coffee'],
  ],

  # emoticons
  'emoticons_append': { # for adding special emoticons (TODO: import discord)
    'custom_mind_explode': {
      'keywords': ['brain', 'mind', 'explode', 'blown'],
      'char': '🤯',
      'category': 'people'
    }
  },
  'emoticons_database': 'emojis',          # uses Emojis as default emoticons

  # help
  'help_tabs': ['shortcuts', 'keyboardnav', 'plugins', 'versions'],
}
