# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
# See https://docs.djangoproject.com/en/3.1/howto/deployment/checklist/

import os
from django.utils.translation import gettext_lazy as _
import dj_database_url

SETTINGS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = os.path.dirname(SETTINGS_DIR)
BASE_DIR = os.path.dirname(PROJECT_DIR)

SECRET_KEY = os.environ.get('SECRET_KEY')

SITE_ID = 1

INTERNAL_IPS = ['127.0.0.1', 'localhost', '[::1]']
ALLOWED_HOSTS = INTERNAL_IPS

ROOT_URLCONF = 'website.urls'

WSGI_APPLICATION = 'website.wsgi.application'

TEST_RUNNER = 'website.tests.runner.PytestRunner'

DATA_UPLOAD_MAX_MEMORY_SIZE = None

WAGTAIL_SITE_NAME = "website"
#BASE_URL = 'https://www.princetonterraceclub.org' # full url prefix (emails...)

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
  os.path.join(PROJECT_DIR, 'frontend/static'),
]

# Serving static
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
STATIC_URL = '/static/'

# Serving media
MEDIA_ROOT = os.path.join(PROJECT_DIR, 'media')
MEDIA_URL = '/media/'


# Auth validation
AUTH_PASSWORD_VALIDATORS = [
  {'NAME': 
    'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'
  },
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
      os.path.join(PROJECT_DIR, 'templates'),
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


DATABASES = {
  'default': dj_database_url.parse(
    'postgres://{user}:{password}@{host}:5432/{name}'.format(**dict(zip(
      ['user', 'password', 'host', 'name'], 
      [os.environ.get(var) for var in [
        'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_HOST', 'POSTGRES_DB'
      ]]
    ))), 
    engine='django.db.backends.postgresql', 
    conn_max_age=600
  ),
}

### Internationalization & Language ###
LANGUAGE_CODE = 'en-us'
LANGUAGES = [
  ('en', _('English')),
]
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = True
USE_TZ = True


### DEFAULT LOGGERS ###

LOGGING = {
  'version': 1,
  'disable_existing_loggers': False,
  'formatters': {
    'verbose': {
      'format': ' | '.join([
        '{levelname}', '{asctime}', 'Module {module}', 'Process {process:d}',
        'Thread {thread:d}', 'Message "{message}"'
      ]),
      'style': '{', # instead of %() syntax
    },
    'simple': {
      'format': '{levelname} | "{message}"',
      'style': '{', # instead of %() syntax
    },
  },
  'filters': {
    'require_debug_true': {
      '()': 'django.utils.log.RequireDebugTrue',
    },
    'require_debug_false': {
      '()': 'django.utils.log.RequireDebugFalse',
    },
  },
  'handlers': {
    'console': {
      'level': 'INFO',
      'class': 'logging.StreamHandler',
      'filters': ['require_debug_true'],
      'formatter': 'simple'
    },
    'file': {
      'level': 'ERROR',
      'class': 'logging.FileHandler',
      'filters': ['require_debug_false'],
      'formatter': 'verbose',
      'filename': os.path.join(BASE_DIR, 'logs/error.log')
    },
    'mail_admins': {
      'level': 'ERROR',
      'class': 'django.utils.log.AdminEmailHandler',
      'filters': ['require_debug_false'],
      'formatter': 'verbose',
    }
  },
  'loggers': {
    'django.request': {
      'handlers': ['mail_admins'],
      'level': 'ERROR',
      'propagate': False,
    },
    'django.template': {
      'handlers': ['console'],
      'level': 'DEBUG',
      'propagate': True
    },
    'django.db.backends': {
      'handlers': ['file'],
      'level': 'ERROR',
      'propagate': True
    },
  }
}
