from tinymce.widgets import TinyMCE
from tinymce.settings import JS_URL, USE_EXTRA_MEDIA
from django.forms import Media

class UserTinyMCE(TinyMCE):
  """ 
  Extension of TinyMCE widget to reset file picker callback (I think due
  to an error it was raising???) TODO: find out why lol
  """
  def get_mce_config(self, attrs):
    mce_config = super().get_mce_config(attrs)
    try:
      del mce_config["file_picker_callback"]
    except KeyError:
      pass
    return mce_config

  def _media(self):
    css = None
    js = [JS_URL]
    if USE_EXTRA_MEDIA:
      if "js" in USE_EXTRA_MEDIA:
        js += USE_EXTRA_MEDIA["js"]
      if "css" in USE_EXTRA_MEDIA:
        css = USE_EXTRA_MEDIA["css"]
    js.append("django_tinymce/init_tinymce.js")
    return Media(css=css, js=js)