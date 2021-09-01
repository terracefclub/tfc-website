""" 
General purpose template tags used throughout the application.
"""

import os
import random
from django.template.defaulttags import register

@register.filter
def addstr(str1, str2):
  """ Concatenates the string representation of `str1` and `str2` """
  return str(str1) + str(str2)

@register.filter(name='get')
def retrieve_dynamic_value(dict_, key):
  """
  Access a dictionary value dynamically in the template
  :type dict_: dict[Any, Any]
  :type key: Any
  """
  return dict_[key]

@register.filter
def equals(val1, val2):
  """
  A simple value comparison, used to set a boolean value in a ``with`` tag
  using the "=" syntax to support simultaneous value instantiation.
  :type val1: Any
  :type val2: Any
  """
  return val1 == val2

@register.filter
def notequals(val1, val2):
  """
  The negation of :tag:`equals` for the same purpose
  :type val1: Any
  :type val2: Any
  """
  return val1 != val2

@register.filter
def env(key):
  """
  Access environmental variables (like secrets) in template
  :param key: the name of an environmental variable in the process
  :type key: str
  """
  return os.environ.get(key, None)

@register.filter(name='range')
def range_from_num(value):
  """
  Python ``range()`` function for use in template
  :param value: the length of the range
  :type value: int
  """
  return range(value)

@register.filter(name='subtract')
def subtract_integers(int1, int2):
  """
  First use case for integer arithmetic in tags
  :type int1: int
  :type int2: int
  """
  return int1 - int2

@register.simple_tag(takes_context=True)
def set_breakpoint(context):
  """ Debugger tag, passes the template context """
  breakpoint()

@register.simple_tag(name='random')
def random_number(max_num):
  """
  Pass a random integer into template, bounded above by:
  :param max_num: upper bound of random integer selection
  :type max_num: int
  :return: random integer
  :rtype: int
  """
  return random.randrange(1, max_num)

@register.simple_tag()
def most_recent_menu():
  """
  Retrieves the most recent menu item for display on the home page in case there
  is no menu for the current week.
  """
  from ..models import WeeklyMenuPage
  return WeeklyMenuPage.objects.last()


@register.filter
def trim_digits(number):
  """ 
  Basic 1000's formatter to list values like '1234' as '1.2K'
  :param number: some positive integer (not expecting higher than 1 million)
  :type number: int
  """
  if number >= 1100:
    return f'{number/1000:.1f}K'
  return str(number)