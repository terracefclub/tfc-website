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

CACHES = {
  'default': {
    'BACKEND': 'django_redis.cache.RedisCache',
    'LOCATION': 'redis://redis',
    'OPTIONS': {

      # consider benefits of HerdClient or ShardClient (experimental)
      'CLIENT_CLASS': 'django_redis.client.DefaultClient', 
      'PARSER_CLASS': 'redis.connection.HiredisParser',

      # emulates defualt MemCached behavior to ignore exceptions when cache is down (logging added below!)
      'IGNORE_EXCEPTIONS': True,

      # for flexible pickling - does not work on templates!
      # 'SERIALIZER': 'django_redis.serializers.json.JSONSerializer' 
    }
  }
}

# Site Caching!
CACHE_MIDDLEWARE_ALIAS = 'default' # DEFAULT
CACHE_MIDDLEWARE_SECONDS = 60 * 10 # DEFAULT (10 minutes!)
CACHE_MIDDLEWARE_KEY_PREFIX = ''   # DEFAULT (only one site using cache)

# session caching!
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"
DJANGO_REDIS_LOG_IGNORED_EXCEPTIONS = True