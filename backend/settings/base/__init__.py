
from .core import *
from .extras import *
from .services import *
from .logging import *

# Application definition
INSTALLED_APPS = [

  # Proprietary
  'base',
  'blog',
  'events',
  'menus',

  # Third party
  'leaflet',                     # Easily integrating maps into views
  'wagtail_nav_menus',           # Configurable navigation menus in Wagtail
  'modelcluster',                # Simultaneous model instantiation (Wagtail)
  'taggit',                      # MVC support for tagging models
  'taggit_autosuggest',          # autocompletion and UI for taggit system
  'django_apscheduler',          # Scheduling cron jobs in Django
  'wagtailmedia',                # Audio and video files in Wagtail
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

