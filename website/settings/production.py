from .base import *

DEBUG = False
SECURE_SSL_REDIRECT = True
WAGTAIL_SEARCH_BACKENDS['default']['HOSTS'][0]['use_ssl'] = True
WAGTAIL_SEARCH_BACKENDS['default']['HOSTS'][0]['verify_certs'] = True

LOGGING = {
  'version': 1,
  'disable_existing_loggers': False,
  'handlers': {
    'console': {
      'class': 'logging.StreamHandler',
    },
  },
  'loggers': {
    'django': {
      'handlers': ['console'],
      'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
    },
  },
}