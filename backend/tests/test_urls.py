from django.urls import reverse, resolve
from django.test import SimpleTestCase


class TestUrls(SimpleTestCase):
    def test_base_urls(self):
        url = reverse("archive")
        self.assertEqual(url, "/archive/")
        self.assertEqual(resolve(url).view_name, "archive")

        url = reverse("search")
        self.assertEqual(url, "/search/")
        self.assertEqual(resolve(url).view_name, "search")

    def test_events_urls(self):
        url = reverse("event_detail")
        self.assertEqual(url, "/events/event/")
        self.assertEqual(resolve(url).view_name, "event_detail")

        url = reverse("event_socials")
        self.assertEqual(url, "/events/socials/")
        self.assertEqual(resolve(url).view_name, "event_socials")

        url = reverse("events_filter")
        self.assertEqual(url, "/events/filter/")
        self.assertEqual(resolve(url).view_name, "events_filter")
