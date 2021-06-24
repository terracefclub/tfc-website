from .base import *

DEBUG = False
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

CACHES = {
  'default': {
    'BACKEND': 'django_redis.cache.RedisCache',
    'LOCATION': 'redis://redis',
    'OPTIONS': {

      # consider benefits of HerdClient or ShardClient (experimental)
      'CLIENT_CLASS': 'django_redis.client.DefaultClient', 
      'PARSER_CLASS': 'redis.connection.HiredisParser',

      # emulates defualt MemCached behavior to ignore exceptions when cache 
      # is down (logging added below!)
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
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
DJANGO_REDIS_LOG_IGNORED_EXCEPTIONS = True

LOGGING['loggers'].update({
  'django': {
    'handlers': ['file'],
    'level': 'ERROR',
    'propagate': True
  }
})

# SEARCH SUPPORT
# from elasticsearch import RequestsHttpConnection

"""
ELASTICSEARCH_ENDPOINT = 'elasticsearch'
WAGTAILSEARCH_BACKENDS = {
  'default': {
    'BACKEND': 'wagtail.search.backends.elasticsearch7',
    'HOSTS': [{
      'host': ELASTICSEARCH_ENDPOINT,
      'port': int(os.environ.get('ELASTICSEARCH_PORT', '9200')),
    }],
    'OPTIONS': {
      'connection_class': RequestsHttpConnection
    },
    'URLS': ['http://<username>:<password>@localhost:9200'],
    'INDEX': 'wagtail',
    'TIMEOUT': 5,
    'OPTIONS': {},
    'INDEX_SETTINGS': {},
  }
}
"""