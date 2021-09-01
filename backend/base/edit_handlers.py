"""
Supported Wagtail file for admin widgets. Includes modifications for the base
site to provide full functionality.
"""

from itertools import chain
from wagtail.admin.edit_handlers import InlinePanel as BaseInlinePanel

class InlinePanel(BaseInlinePanel):
  """
  Mimics a native Wagtail InlinePanel but fixes a bug that prevents nested
  InlinePanels from rendering subwidgets correctly.

  Ref. https://github.com/wagtail/wagtail/issues/5126
  """
  def widget_overrides(self):
    """ Override widgets by iterating through all handlers and subhandlers """
    handler = self.get_child_edit_handler()
    widgets = dict(chain(*(
      subhandler.widget_overrides().items()\
      for subhandler in handler.children)))
    return {self.relation_name: widgets}
