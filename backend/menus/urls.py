from django.urls import path, register_converter
from datetime import datetime
from .views import get_other_menus, handle_menu_upload


class DateConverter:
    regex = r"\d{2}-\d{2}-\d{4}"

    def to_python(self, value):
        return datetime.strptime(value, "%m-%d-%Y")

    def to_url(self, value):
        return value


register_converter(DateConverter, "mmddyyyy")

urlpatterns = [
    path("others/", get_other_menus, name="other_menus"),
    path("upload/<mmddyyyy:monday>/", handle_menu_upload, name="menu_upload"),
]
