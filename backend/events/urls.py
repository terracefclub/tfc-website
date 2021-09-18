from django.urls import path

from .views import event_detail, event_social, events_filter

urlpatterns = [
    path("event/", event_detail, name="event_detail"),
    path("socials/", event_social, name="event_socials"),
    path("filter/", events_filter, name="events_filter"),
]
