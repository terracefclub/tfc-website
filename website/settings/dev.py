from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# SECURITY WARNING: define the correct hosts in production!
ALLOWED_HOSTS = ['*'] 

INSTALLED_APPS += [
  'debug_toolbar',
]

RESULTS_CACHE_SIZE = 100

MIDDLEWARE +=  [
  'debug_toolbar.middleware.DebugToolbarMiddleware',
]

INTERNAL_IPS = ("127.0.0.1", "172.17.0.1")


DATABASES = {
  'default': {
    'ENGINE': 'django.db.backends.postgresql',
    'HOST': 'db',
    #'PORT': 5432,
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