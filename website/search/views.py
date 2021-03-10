from django.conf import settings
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.template.response import TemplateResponse

from wagtail.core.models import Page
from wagtail.search.models import Query

from website.blog.models import BlogPage

def search(request):
    search_query = request.GET.get('query', None)

    # Search
    if search_query:
      if 'elasticsearch' in settings.WAGTAILSEARCH_BACKENDS['default']['BACKEND']:
        search_results = Page.objects.live().search(search_query)
      else:
        _models = [BlogPage]
        page_ids = [
          p.page_ptr.id \
          for _model in _models \
          for p in _model.objects.live().search(search_query)
        ]
        search_results = Page.objects.live().filter(id__in=page_ids)
        
      query = Query.get(search_query)
      query.add_hit()
    else:
        search_results = Page.objects.none()

    # Pagination
    paginator = Paginator(search_results, 10)
    page = request.GET.get('page', 1)
    try:
        search_results = paginator.page(page)
    except PageNotAnInteger:
        search_results = paginator.page(1)
    except EmptyPage:
        search_results = paginator.page(paginator.num_pages)

    return TemplateResponse(request, 'search/search.html', {
        'search_query': search_query,
        'search_results': search_results,
    })
