from .base import *
from .production.media import *
import re
import os


DEBUG = False
# SECURE_SSL_REDIRECT = True
# SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
ALLOWED_HOSTS += os.environ.get("ALLOWED_HOSTS", "").split(" ")

INSTALLED_APPS = [
    "filebrowser",  # admin interface for organizing media
    "grappelli",  # admin theme that supports Filebrowser
] + INSTALLED_APPS  # prioritizes grappelli styling over django.contrib.admin

db_parser = re.compile(
    r"(?P<USER>\w+):(?P<PASSWORD>\w+)@(?P<HOST>[\w\.\-]+):(?P<PORT>\d{4,5})"
    r"/(?P<NAME>\w+)"
)
if url_var := os.environ.get("DATABASE_URL"):
    if results := db_parser.search(url_var):
        database_dict = results.groupdict()

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        **database_dict,
    }
}

if not os.environ.get("LOCAL_CACHE"):
    CACHES["default"]["LOCATION"] = os.environ.get("REDIS_URL", "")
