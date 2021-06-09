from tinymce.models import HTMLField
from website.flabyrinth.widgets import UserTinyMCE
from django.contrib.admin.widgets import AdminTextareaWidget
from tinymce.widgets import AdminTinyMCE

class FlabyrinthHTMLField(HTMLField):
  """ Special model field extension of the django-tinymce that uses own widget """
  def formfield(self, **kwargs):
    defaults = { 'widget': UserTinyMCE }
    defaults.update(kwargs)

    # "As an ugly hack, we override the admin widget" -- from django-tinymce
    if defaults["widget"] == AdminTextareaWidget:
      defaults["widget"] = AdminTinyMCE

    return super().formfield(**defaults)