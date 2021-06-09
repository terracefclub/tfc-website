from django.conf import settings

def show_toolbar(request):
  """ 
  Override Django Debug Toolbar display to not show in development mode
  inside of iframes 
  """
  return settings.DEBUG and\
    request.META.get("REMOTE_ADDR") in settings.INTERNAL_IPS and\
    'bio' not in request.GET.getlist('field')