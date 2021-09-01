from django.template.defaulttags import register
import math 

BLOG_CARDS_PER_PAGE = 8

@register.filter
def page_count(length):
  """
  Quick expression to get the number of pages in a :model:`blog.BlogIndexPage`
  :param length: the number of :model:`blog.BlogPage` instances from queryset
  :type length: int
  :return: the "pages" required to display the entire BlogPage queryset over
  :rtype: int
  """
  return math.ceil(length / BLOG_CARDS_PER_PAGE)