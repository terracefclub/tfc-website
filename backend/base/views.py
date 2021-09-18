"""
Generic views that are not Wagtail pages but still interface with Wagtail
models. These are not associated with a particular application but may touch
specific data to multiple applications concurrently.
"""

from django.shortcuts import render
from django.template.response import TemplateResponse
from django.conf import settings
from django.views.decorators.http import require_GET

from wagtail.documents.models import Document
from wagtailmedia.models import Media
from wagtail.images.models import Image
from wagtail.core.models import Page
from wagtail.search.models import Query

from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator

# from base.models import SimplePage
# from blog.models import BlogPage
# from menus.models import WeeklyMenuPage

MAX_ITEMS_DEFAULT_BASE = 15
MAX_ITEMS_DEFAULT = getattr(
    settings, "BASE_MAX_ITEMS_DEFAULT", MAX_ITEMS_DEFAULT_BASE
)


def _fetch_items(model, filters={}):
    """
    Auxiliary item fetcher for view :view:`base.explore_media` to render
    different media items in the public archive.

    :param model: an application model for media to fetch
    :type model: django.db.models.Model
    :param filters: key-value pairs to handle filtering of model, defaults to {}
    :type filters: dict[str, str], optional

    :return: the filtered instances of `model`
    :rtype: django.db.models.QuerySet
    """
    filtered = model.objects.filter(**filters)
    if filtered.exists():

        # order by newest first, limit to a maximum of `MAX_ITEMS_DEFAULT`
        return filtered.order_by("-pk")[
            : min(MAX_ITEMS_DEFAULT, filtered.count())
        ]
    return model.objects.none()


@require_GET
def explore_media(request):
    """
    Display the most recent main media additions to the public facing
    The media classes currently supported are dinner menus, newsletters, audio
    and video files, and pictures of murals in the clubhouse.

    **Context**
    ``data`` {dict[str, django.db.models.QuerySet]} A dictionary of model name
      keys and querysets for display in the archive

    **Template**
    :template:`base/media_archive_page.html`
    :tag:`image` from `wagtailimages` to easily render image files
    """
    models = [
        ("newsletters", Document, {"tags__name": "newsletter"}),
        ("menus", Document, {"tags__name": "menu"}),
        ("audio", Media, {"type": "audio"}),
        ("video", Media, {"type": "video"}),
        ("murals", Image, {"tags__name": "mural"}),
    ]
    data = {
        name: _fetch_items(model, filters) for name, model, filters in models
    }

    context = {"data": data}
    return render(request, "base/media_archive_page.html", context)


@require_GET
def search(request):
    """
    The main search bar view. Renders links to match pages of types:
    :model:`base.SimplePage`, :model:`blog.BlogPage`, and
    :model:`menus.WeeklyMenuPage`.

    **Context**
    ``search_query`` {string} the value searched for, submitted when typed
    ``search_results`` {PaginatorPage} paginated results from aforementeioned
      Page subclasses

    **Template**
    :template:`base/search.html`
    :tag:`pageurl` to link each of `search_results` to the actual page url
    :tag:`url` to link pagination buttons to this view
    :tag:`urlencode` to encode the `search_query` into button href
    """
    search_query = request.GET.get("query", None)

    # Search
    if search_query:
        _models = [Page]
        page_ids = [
            p.page_ptr.id
            for _model in _models
            for p in _model.objects.live().search(search_query)
        ]
        search_results = Page.objects.live().filter(id__in=page_ids)

        query = Query.get(search_query)
        query.add_hit()
    else:
        search_results = Page.objects.none()

    # Pagination
    paginator = Paginator(search_results, 10)
    page = request.GET.get("page", 1)
    try:
        search_results = paginator.page(page)
    except PageNotAnInteger:
        search_results = paginator.page(1)
    except EmptyPage:
        search_results = paginator.page(paginator.num_pages)

    return TemplateResponse(
        request,
        "base/search.html",
        {
            "search_query": search_query,
            "search_results": search_results,
        },
    )
