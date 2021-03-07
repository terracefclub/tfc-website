import os
from django.template.defaulttags import register

@register.filter
def env(key):
  return os.environ.get(key, None)

@register.filter(name='range')
def range_from_num(value):
  return range(value)
