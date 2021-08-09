from django.conf import settings
from django.urls import include, path
from django.contrib import admin
#from whitenoise.storage import StaticFilesStorage
from django.contrib.staticfiles.storage import staticfiles_storage
from django.views.generic.base import RedirectView

from wagtail.core import urls as wagtail_urls
from wagtail.contrib.sitemaps.views import sitemap

from filebrowser.sites import site

urlpatterns = [
  path('django-admin/filebrowser/', site.urls),
  path('grappelli/', include('grappelli.urls')),
  path('django-admin/doc/', include('django.contrib.admindocs.urls')),
  path('django-admin/', admin.site.urls),
  path('admin/', include('wagtail.admin.urls')),
  path('documents/', include('wagtail.documents.urls')),
  path('avatar/', include('avatar.urls')),
  path('tinymce/', include('tinymce.urls')),
  path('taggit_autosuggest/', include('taggit_autosuggest.urls')),
  path('', include('website.base.urls')),
  path('events/', include('website.events.urls')),
  path('menus/', include('website.menus.urls')),
  path('sitemap.xml', sitemap),
]


if settings.DEBUG:

  # Serve static and media files from development server
  from django.conf.urls.static import static
  from django.contrib.staticfiles.urls import staticfiles_urlpatterns
  urlpatterns += staticfiles_urlpatterns()
  urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

  # Django development debugging URLs
  import debug_toolbar
  urlpatterns += [path('__debug__/', include(debug_toolbar.urls))]

# Catch-all for pages in Wagtail
urlpatterns += [path("", include(wagtail_urls))]