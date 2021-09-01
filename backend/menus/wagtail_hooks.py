"""
Hooks to customize Wagtail admin interface
"""

from django.templatetags.static import static 
from django.utils.html import format_html_join
from wagtail.core import hooks

@hooks.register('insert_editor_js')
def editor_js():
  """
  Add script tags for any new JS to put in Wagtail admin.
  NOTE: the current, unimplemented intention was to support field population
  when uploading the PDF document to the :model:`menus.WeeklyMenuPage`
  edit/create endpoints
  """
  js_files = [] # 'js/admin.js']
  return format_html_join('\n', '<script src="{0}"></script>',
    ((static(filename),) for filename in js_files)
  )