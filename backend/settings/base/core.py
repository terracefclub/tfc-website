# Build paths inside the project like this: os.path.join(BACKEND_DIR, ...)
# See https://docs.djangoproject.com/en/3.1/howto/deployment/checklist/

import os
from .constants import BACKEND_DIR, BASE_DIR
from django.utils.translation import gettext_lazy as _

FIXTURE_DIRS = [os.path.join(BACKEND_DIR, 'data')]

SECRET_KEY = os.environ.get('SECRET_KEY')

SITE_ID = 1

INTERNAL_IPS = ['127.0.0.1', 'localhost', '[::1]']
ALLOWED_HOSTS = INTERNAL_IPS

ROOT_URLCONF = 'urls'

DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

WSGI_APPLICATION = 'wsgi.application'

TEST_RUNNER = 'tests.runner.PytestRunner'

DATA_UPLOAD_MAX_MEMORY_SIZE = None

WAGTAIL_SITE_NAME = "website"

AUTHENTICATION_BACKENDS = ['django.contrib.auth.backends.ModelBackend']

### EMAIL ###
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

### STATIC HANDLING ###
# ManifestStaticFilesStorage is recommended in production, to prevent outdated
# JavaScript / CSS assets being served from cache (e.g. after a Wagtail upgrade)
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATICFILES_FINDERS = [
  'django.contrib.staticfiles.finders.FileSystemFinder',
  'django.contrib.staticfiles.finders.AppDirectoriesFinder',
]
STATICFILES_DIRS = [
  os.path.join(BASE_DIR, 'frontend/static'),
]

# Serving static
STATIC_ROOT = os.path.join(BACKEND_DIR, 'static')
STATIC_URL = '/static/'
MEDIA_ROOT = os.path.join(BACKEND_DIR, 'media')
MEDIA_URL = '/media/'

# Auth validation
AUTH_PASSWORD_VALIDATORS = [
  {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
  {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
  {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
  {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


MIDDLEWARE = [
  'django.middleware.security.SecurityMiddleware',
  'whitenoise.middleware.WhiteNoiseMiddleware',

  # do NOT mess with the order of this caching middleware section!
  'django.middleware.cache.UpdateCacheMiddleware',      # Expires, Cache-Control
  'django.contrib.sessions.middleware.SessionMiddleware', # Vary - Cookie
  'django.middleware.common.CommonMiddleware',
  'django.middleware.cache.FetchFromCacheMiddleware',

  'django.middleware.csrf.CsrfViewMiddleware',
  'django.contrib.auth.middleware.AuthenticationMiddleware',
  'django.contrib.messages.middleware.MessageMiddleware',
  'django.middleware.clickjacking.XFrameOptionsMiddleware',
  'django.contrib.admindocs.middleware.XViewMiddleware',
  'wagtail.contrib.redirects.middleware.RedirectMiddleware',
]

TEMPLATES = [
  {
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [
      os.path.join(BACKEND_DIR, 'templates'),
    ],
    'APP_DIRS': True,
    'OPTIONS': {
      'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
      ],
    },
  },
]

### Internationalization & Language ###
LANGUAGE_CODE = 'en-us'
LANGUAGES = [
  ('en', _('English')),
]
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = True
USE_TZ = True