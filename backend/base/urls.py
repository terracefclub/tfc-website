from django.urls import path
from .views import explore_media, search

urlpatterns = [
    path("archive/", explore_media, name="archive"),
    path("search/", search, name="search"),
]
