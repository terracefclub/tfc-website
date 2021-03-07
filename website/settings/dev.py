from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# SECURITY WARNING: define the correct hosts in production!
ALLOWED_HOSTS = ['*'] 

INSTALLED_APPS += [
  'debug_toolbar',
]

MIDDLEWARE +=  [
  'debug_toolbar.middleware.DebugToolbarMiddleware',
]

INTERNAL_IPS = ("127.0.0.1", "172.17.0.1")

    
#CACHES['default']['LOCATION'] = 'redis://localhost:6379/0'

DATABASES = {
  'default': {
    'ENGINE': 'django.db.backends.sqlite3', # postgresql',
    'NAME': os.path.join(BASE_DIR, 'db.sqlite3') # 'web',
    #'USER': 'user',
    #'PASSWORD': 'password',
    #'PORT': 5432,
  }
}