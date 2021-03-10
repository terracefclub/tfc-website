# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
# See https://docs.djangoproject.com/en/3.1/howto/deployment/checklist/
import os

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(PROJECT_DIR)

SECRET_KEY = os.environ.get('SECRET_KEY')

# Application definition
INSTALLED_APPS = [
  'website.base',
  'website.search',
  'website.blog',
  'website.theme',
  'website.events',
  
  # Authentication & Users
  
  #'allauth',
  #'allauth.account',
  #'allauth.socialaccount',
  #'allauth.socialaccount.providers.discord',
  #'allauth.socialaccount.providers.facebook',
  #'allauth.socialaccount.providers.google',
  #'allauth.socialaccount.providers.instagram',
  #'allauth.socialaccount.providers.linkedin',
  #'allauth.socialaccount.providers.paypal',
  #'allauth.socialaccount.providers.stripe',
  #'allauth.socialaccount.providers.twitter',
  #'allauth.socialaccount.providers.spotify',
  #'allauth.socialaccount.providers.soundcloud',
  #'allauth.socialaccount.providers.untappd',
  #'allauth.socialaccount.providers.zoom',
  

  # Adapted from "https://gitlab.com/thelabnyc/wagtail-nav-menus"
  'website.wagtail_nav_menus',

  # External frontend services
  'tailwind',
  'fontawesome-free',
  'leaflet',
  'clearcache',

  # External backend services
  'modelcluster',
  'taggit',
  'coverage',

  'wagtail.contrib.forms',
  'wagtail.contrib.redirects',
  'wagtail.contrib.modeladmin',
  'wagtail.embeds',
  'wagtail.sites',
  'wagtail.users',
  'wagtail.snippets',
  'wagtail.documents',
  'wagtail.images',
  'wagtail.search',
  'wagtail.admin',
  'wagtail.core',
  
  'django.contrib.admin',
  'django.contrib.auth',
  'django.contrib.contenttypes',
  'django.contrib.sessions',
  'django.contrib.messages',
  'django.contrib.staticfiles',
  'django.contrib.sitemaps',
  'django.contrib.sites'
]

SITE_ID = 1
SOCIALACCOUNT_PROVIDERS = {
  'discord': {

  },
  'facebook': {

  },
  'google': {

  },
  'instagram': {

  },
  'linkedin': {

  },
  'paypal': {

  },
  'stripe': {

  },
  'twitter': {

  },
  'spotify': {

  },
  'soundcloud': {

  },
  'untappd': {

  },
  'zoom': {

  },
}

WAGTAIL_NAV_MENU_TYPES = [
  ('page_link', 'wagtail_nav_menus.models', 'InternalPageBlock'),
  ('external_link', 'wagtail_nav_menus.models', 'ExternalPageBlock'), 
  ('django_url', 'wagtail_nav_menus.models', 'DjangoURLBlock'), 
  ('relative_url', 'wagtail_nav_menus.models', 'RelativeURLBlock'), 
  ('image', 'wagtail.images.blocks', 'ImageChooserBlock'), 
  ('html', 'wagtail.core.blocks', 'RawHTMLBlock')
]
WAGTAIL_NAV_MENU_CHOICES = (
  ("top", "Top"),
  ("footer", "Footer"),
  ("sidebar", "Sidebar"),
)
TAILWIND_APP_NAME = 'theme'


MIDDLEWARE = [
  'django.middleware.security.SecurityMiddleware',
  'whitenoise.middleware.WhiteNoiseMiddleware',

  # do NOT mess with the order of this caching middleware section!
  'django.middleware.cache.UpdateCacheMiddleware',        # adds Expires, Cache-Control
  'django.contrib.sessions.middleware.SessionMiddleware', # adds Vary - Cookie
  'django.middleware.common.CommonMiddleware',
  'django.middleware.cache.FetchFromCacheMiddleware',

  'django.middleware.csrf.CsrfViewMiddleware',
  'django.contrib.auth.middleware.AuthenticationMiddleware',
  'django.contrib.messages.middleware.MessageMiddleware',
  'django.middleware.clickjacking.XFrameOptionsMiddleware',
  'wagtail.contrib.redirects.middleware.RedirectMiddleware',
]

ROOT_URLCONF = 'website.urls'

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

WSGI_APPLICATION = 'website.wsgi.application'

CACHES = {
  'default': {
    'BACKEND': 'django_redis.cache.RedisCache',
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
'''


from elasticsearch import RequestsHttpConnection
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
    }
    # 'URLS': ['http://<username>:<password>@localhost:9200'],
    # 'INDEX': 'wagtail',
    # 'TIMEOUT': 5,
    # 'OPTIONS': {},
    # 'INDEX_SETTINGS': {},
  }
}
'''
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Password validation
# https://docs.djangoproject.com/en/3.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

AUTHENTICATION_BACKENDS = (
  'django.contrib.auth.backends.ModelBackend',
  'allauth.account.auth_backends.AuthenticationBackend',
)

# Internationalization
# https://docs.djangoproject.com/en/3.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.1/howto/static-files/

STATICFILES_FINDERS = [
  'django.contrib.staticfiles.finders.FileSystemFinder',
  'django.contrib.staticfiles.finders.AppDirectoriesFinder',
]

STATICFILES_DIRS = [
  os.path.join(PROJECT_DIR, 'theme/static'),
]

# ManifestStaticFilesStorage is recommended in production, to prevent outdated
# JavaScript / CSS assets being served from cache (e.g. after a Wagtail upgrade).
# See https://docs.djangoproject.com/en/3.1/ref/contrib/staticfiles/#manifeststaticfilesstorage
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

STATIC_ROOT = os.path.join(PROJECT_DIR, 'collect_static')
STATIC_URL = '/static/'

MEDIA_ROOT = os.path.join(PROJECT_DIR, 'media')
MEDIA_URL = '/media/'


# Wagtail settings

WAGTAIL_SITE_NAME = "website"

# Base URL to use when referring to full URLs within the Wagtail admin backend -
# e.g. in notification emails. Don't include '/admin' or a trailing slash
#BASE_URL = 'http://example.com'