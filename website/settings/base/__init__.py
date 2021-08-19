
from .core import *
from .extras import *
from .tinymce import *

# put any settings that are a mixture of core and extras settings below!

AUTHENTICATION_BACKENDS = [
  'django.contrib.auth.backends.ModelBackend'
]

# Application definition
INSTALLED_APPS = [

  # Proprietary
  'website.base',
  'website.blog',
  'website.events',
  'website.menus',

  # Third party
  'fontawesome-free',            # Icons!
  'leaflet',                     # Easily integrating maps into views
  'clearcache',                  # Mgmt support for simple cache clearing
  'wagtail_nav_menus',           # Configurable navigation menus in Wagtail
  'modelcluster',                # Simultaneous model instantiation (Wagtail)
  'taggit',                      # MVC support for tagging models
  'taggit_autosuggest',          # autocompletion and UI for taggit system
  'coverage',                    # Testing coverage suite for Django
  'django_apscheduler',          # Scheduling cron jobs in Django
  'wagtailmedia',                # Audio and video files in Wagtail
  'grappelli',                   # admin theme that supports Filebrowser
  'filebrowser',                 # admin interface for organizing media
  'tinymce',                     # richtext support beyond Wagtail using TinyMCE
  'wagtailstreamforms',          # adds form building options to StreamField

  # Wagtail
  'wagtail.contrib.forms',
  'wagtail.contrib.redirects',
  'wagtail.contrib.modeladmin',
  'wagtail.contrib.postgres_search',
  'wagtail.embeds',
  'wagtail.sites',
  'wagtail.users',
  'wagtail.snippets',
  'wagtail.documents',
  'wagtail.images',
  'wagtail.search',
  'wagtail.admin',
  'wagtail.core',
  
  # Django
  'django.contrib.admin',
  'django.contrib.admindocs',
  'django.contrib.auth',
  'django.contrib.contenttypes',
  'django.contrib.sessions',
  'django.contrib.messages',
  'django.contrib.staticfiles',
  'django.contrib.sitemaps',
  'django.contrib.sites'
]
