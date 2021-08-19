from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# SECURITY WARNING: define the correct hosts in production!
ALLOWED_HOSTS += ['*']

INSTALLED_APPS = [
  'whitenoise.runserver_nostatic',
  'debug_toolbar',
] + INSTALLED_APPS



MIDDLEWARE +=  [
  'debug_toolbar.middleware.DebugToolbarMiddleware',
]


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

DATABASES = {
  'default': {
    'ENGINE': 'django.db.backends.postgresql',
    'NAME': 'web',
    'USER': 'user',
    'PASSWORD': 'password',
    'HOST': 'postgres',
    'PORT': '5432',
  }
}