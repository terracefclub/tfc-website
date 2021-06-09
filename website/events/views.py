from django.shortcuts import render 
from django.conf import settings
from django.http import HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from .models import Event



# Home pages of common social media sites
SOCIALS_DEFAULT_BASE = {
  'instagram': 'https://www.instagram.com/',
  'facebook': 'https://www.facebook.com',
  'zoom': 'https://zoom.us/'
}
SOCIALS_DEFAULT = getattr(settings, 
  'EVENTS_SOCIALS_DEFAULT', SOCIALS_DEFAULT_BASE)

# The default social media sites to display
SOCIALS_DISPLAY_DEFAULT_BASE = ['instagram', 'facebook', 'zoom']
SOCIALS_DISPLAY_DEFAULT = getattr(settings, 
  'EVENTS_SOCIALS_DISPLAY_DEFAULT', SOCIALS_DISPLAY_DEFAULT_BASE)



def _get_event(request):
  """
  Auxiliary request processor for views :view:`website.events.event_detail` and
  :view:`website.events.event_social` to return a specific instance of
  :model:`website.events.Event` (can be None!)

  :param django.http.HttpRequest request: the request created by Django for URL
  """
  pk = request.GET.get('pk', None)
  event = Event.objects.filter(pk=pk).first() # silent failure returns NoneType
  return event


@require_http_methods(["GET"])
def event_detail(request):
  """ 
  Display an individual :model:`website.events.Event`.

  **Query Parameters**
  ``pk`` The primary key of an instance of :model:`website.events.Event`

  **Context**
  ``event`` {:model:`website.events.Event`} The instance to be displayed
  
  **Template**
  :template:`events/event_detail.html`
  :tag:`image` from `wagtailimages` to display the event image
  :tag:`static` to include a default image in case there is none defined
  :tag:`richtext` from `wagtailcore` to properly display an unexcaped
  `wagtail.core.models.RichTextField`
  """
  context = { 'event': _get_event(request) }
  return render(request, 'events/event_detail.html', context)


@require_http_methods(["GET"])
def event_social(request):
  """ 
  Display the social media icon links for a single :model:`website.events.Event`

  **Query Parameters**
  ``pk`` The primary key of an instance of :model:`website.events.Event`
  ``social`` (list) Domain names for the social resources to display

  **Context**
  ``links`` {List[Tuple[str, str]]} The URLs of the
    :model:`website.events.Event` instance
  
  **Template**
  :template:`events/event_detail.html`
  :tag:`image` from `wagtailimages` to display the event image
  :tag:`static` to include a default image in case there is none defined
  :tag:`richtext` from `wagtailcore` to properly display an unexcaped
  `wagtail.core.models.RichTextField`
  """
  event = _get_event(request)
  socials = request.GET.getlist('social', SOCIALS_DISPLAY_DEFAULT)

  links = []
  for social in socials:

    # match all event links that contain the values `social`
    matches = [link.value for link in event.links if social in link.value]

    # include the first match or the site default otherwise
    link = matches[0] if len(matches) > 0 else SOCIALS_DEFAULT[social]
    links.append((social, link))

  context = { 'links': links }
  return render(request, 'events/event_socials.html', context)


@require_http_methods(["GET"])
def events_filter(request):
  """ 
  Display the event calendar with the relevant instances of 
    :model:`website.events.Event` (i.e. within specified timeframe)

  **Query Parameters**
  ``year`` The calendar year to filter events
  ``month`` The calendar month to filter events

  **Context**
  ``events`` {List[:model:`website.events.Event`]} The contemporaneous events
  ``start__year`` {int} The starting calendar year passed into query
  ``start__month`` {int} The starting calendar month passed into query
  
  **Template**
  :template:`events/event_calendar.html`
  :tag:`image` from `wagtailimages` to display the event image
  :tag:`static` to include a default image in case there is none defined
  :tag:`richtext` from `wagtailcore` to properly display an unexcaped
  `wagtail.core.models.RichTextField`
  """
  fields = ['year', 'month']

  # handle missing query parameters
  for field in fields:
    if field not in request.GET:
      return HttpResponseBadRequest(f'{field} was not specified in request')
  
  # filter by starting date in time range specified by `fields`
  q_params = [request.GET[field] for field in fields]
  db_params = {f'start__{field}': int(p) for field, p in zip(fields, q_params)}
  events = Event.objects.filter(**db_params)

  context = { 'events': events, **db_params}
  return render(request, 'events/event_calendar.html', context)
