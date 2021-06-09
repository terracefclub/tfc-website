from django.template.defaulttags import register

@register.filter
def basepath(path):
  """ 
  Returns a portion of the URL path to identify which section of flabyrinth 
  is currently being visited. Used to highlight the sidebar navigation area.
  """
  return '/'.join(path.split('/')[:3] + [''])
