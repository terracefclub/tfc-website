from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# SECURITY WARNING: define the correct hosts in production!
ALLOWED_HOSTS = ['*'] 
INTERNAL_IPS = ['127.0.0.1', '172.17.0.1']

INSTALLED_APPS = [
  'whitenoise.runserver_nostatic',
  'debug_toolbar',
] + INSTALLED_APPS



MIDDLEWARE +=  [
  'debug_toolbar.middleware.DebugToolbarMiddleware',
]


DATABASES = {
  'default': {
    'ENGINE': 'django.db.backends.postgresql',
    'HOST': 'db',
    #'PORT': 5432, TODO: resolve randomized ports in Docker Compose instance
    'NAME': 'web',
    'USER': 'user',
    'PASSWORD': 'password',
  }
}


CACHES = {
  'default': {
    'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
  }
}
RESULTS_CACHE_SIZE = 100



WAGTAILSEARCH_BACKENDS = {
  'default': {
    'BACKEND': 'wagtail.contrib.postgres_search.backend',
    'AUTO_UPDATE': True # optimize with False and update_index()
  }
}

DEBUG_TOOLBAR_CONFIG = {
  'SHOW_TOOLBAR_CALLBACK': 'website.flabyrinth.middleware.show_toolbar'
}
