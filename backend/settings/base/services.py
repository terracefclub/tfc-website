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

CACHES = {
  'default': {
    'BACKEND': 'django_redis.cache.RedisCache',
    'LOCATION': 'redis://redis',
    'OPTIONS': {
      'CLIENT_CLASS': 'django_redis.client.DefaultClient', 
      'PARSER_CLASS': 'redis.connection.HiredisParser',
      'IGNORE_EXCEPTIONS': True,
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

import os
if not os.environ.get('LOCAL_CACHE'):
  CACHES["default"]["LOCATION"] = os.environ.get('REDIS_URL')