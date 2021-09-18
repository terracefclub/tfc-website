from wagtail_nav_menus.defaults import (
    WAGTAIL_NAV_MENU_CHOICES_DEFAULT,
    WAGTAIL_NAV_MENU_TYPES_DEFAULT,
)
from glob import glob

### WAGTAIL_NAV_MENUS ###
WAGTAIL_NAV_MENU_TYPES = (
    WAGTAIL_NAV_MENU_TYPES_DEFAULT + []
)  # nothing added yet
WAGTAIL_NAV_MENU_CHOICES = WAGTAIL_NAV_MENU_CHOICES_DEFAULT + (
    ("sidebar", "Sidebar"),
)

GDAL_LIBRARY_PATH = glob("/usr/lib/libgdal.so.*")[0]
GEOS_LIBRARY_PATH = glob("/usr/lib/libgeos_c.so.*")[0]

EVENTS_SOCIALS_DEFAULT = {
    "instagram": "https://www.instagram.com/terracefclub/",
    "facebook": "https://www.facebook.com/terracefclub/",
    "zoom": "https://zoom.us/",
}
