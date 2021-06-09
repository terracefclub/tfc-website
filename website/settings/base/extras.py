import os
from django.urls.base import reverse_lazy
from wagtail_nav_menus.defaults import (
  WAGTAIL_NAV_MENU_CHOICES_DEFAULT, WAGTAIL_NAV_MENU_TYPES_DEFAULT
)

### ALLAUTH ###
LOGIN_URL = reverse_lazy('flabyrinth:login')
LOGIN_REDIRECT_URL = reverse_lazy('flabyrinth:post_list')
ACCOUNT_FORMS = {
  'signup': 'website.flabyrinth.forms.RegistrationForm'
}
ACCOUNT_LOGOUT_REDIRECT_URL = '/'
ACCOUNT_SESSION_REMEMBER = True # always remembers user
ACCOUNT_USERNAME_BLACKLIST = ["admin", "root"] # usernames not allowed
ACCOUNT_USERNAME_MIN_LENGTH = 4
ACCOUNT_USERNAME_VALIDATORS = 'website.flabyrinth.validators.uname_validators'

### AVATAR ###
AVATAR_DEFAULT_SIZE = 250

### PHONENUMBER_FIELD ###
PHONENUMBER_DEFAULT_REGION = 'US'

### APSCHEDULER ###
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
APSCHEDULER_DATETIME_FORMAT = "N y, Y, f:s a"
APSCHEDULER_RUN_NOW_TIMEOUT = 25

### WAGTAIL_NAV_MENUS ###
WAGTAIL_NAV_MENU_TYPES = WAGTAIL_NAV_MENU_TYPES_DEFAULT + [] # nothing added yet
WAGTAIL_NAV_MENU_CHOICES = WAGTAIL_NAV_MENU_CHOICES_DEFAULT + (
  ("sidebar", "Sidebar"),
)