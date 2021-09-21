from django.conf import settings
from django.urls import include, path
from django.contrib import admin

from wagtail.core import urls as wagtail_urls
from wagtail.contrib.sitemaps.views import sitemap

from menus.views import handle_menu_upload

urlpatterns = [
    path("django-admin/doc/", include("django.contrib.admindocs.urls")),
    path("django-admin/", admin.site.urls),
    path("admin/", include("wagtail.admin.urls")),
    path("documents/", include("wagtail.documents.urls")),
    path("taggit_autosuggest/", include("taggit_autosuggest.urls")),
    path("", include("base.urls")),
    path("events/", include("events.urls")),
    path("menus/", include("menus.urls")),
    path("menus/upload/", handle_menu_upload, name="menu_upload"),
    path("sitemap.xml", sitemap),
]


if settings.DEBUG:

    # Serve static and media files from development server
    from django.conf.urls.static import static
    from django.contrib.staticfiles.urls import staticfiles_urlpatterns

    urlpatterns += staticfiles_urlpatterns()

    if not settings.CLOUD_MEDIA:
        urlpatterns += static(
            settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
        )

    # Django development debugging URLs
    import debug_toolbar

    urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]

# Catch-all for pages in Wagtail
urlpatterns += [path("", include(wagtail_urls))]
