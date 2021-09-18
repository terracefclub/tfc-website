from django.urls import path

from .views import get_other_menus

urlpatterns = [path("others/", get_other_menus, name="other_menus")]
