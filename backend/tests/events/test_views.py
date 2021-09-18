from django.test import TestCase
from django.urls import reverse
from urllib.parse import urlencode

# from wagtail.tests.utils.form_data import streamfield
from tests.events.factories import EventFactory
from django.utils import timezone
from datetime import timedelta


class EventDetailViewTest(TestCase):
    def test_context(self):
        event = EventFactory()
        response = self.client.get(reverse("event_detail") + f"?pk={event.pk}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["event"], event)
        self.assertContains(response, event.name)

    def test_empty_context(self):
        response = self.client.get(reverse("event_detail") + "?pk=1")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.context["event"])
        self.assertContains(
            response,
            "Please select an event in the calendar view to see more"
            "information.",
        )


class EventSocialsViewTest(TestCase):
    def setUp(self):
        super().setUp()
        self.event = EventFactory(
            links__0__url__value="https://www.instagram.com/terracefclub",
            links__1__url__value="https://www.facebook.com/terracefclub",
            links__2__url__value="https://zoom.us/tfc",
            links__3__url__value="https://gather.town/terracefclub",
        )
        self.url = reverse("event_socials")

    def test_socials_default(self):
        response = self.client.get(self.url + f"?pk={self.event.pk}")
        self.assertEqual(
            response.context["links"],
            [
                ("instagram", "https://www.instagram.com/terracefclub"),
                ("facebook", "https://www.facebook.com/terracefclub"),
                ("zoom", "https://zoom.us/tfc"),
            ],
        )

    def test_socials_three_specific(self):
        q_params = {
            "pk": self.event.pk,
            "social": ["gather.town", "facebook", "zoom"],
        }
        response = self.client.get(
            self.url + "?" + urlencode(q_params, doseq=True)
        )
        self.assertEqual(
            response.context["links"],
            [
                ("gather.town", "https://gather.town/terracefclub"),
                ("facebook", "https://www.facebook.com/terracefclub"),
                ("zoom", "https://zoom.us/tfc"),
            ],
        )

    def test_socials_missing_skipped(self):
        q_params = {"pk": self.event.pk, "social": ["reddit", "zoom"]}
        response = self.client.get(
            self.url + "?" + urlencode(q_params, doseq=True)
        )
        self.assertEqual(
            response.context["links"], [("zoom", "https://zoom.us/tfc")]
        )

    def test_socials_missing_to_default(self):
        event = EventFactory(
            links__0__url__value="https://www.instagram.com/terracefclub",
            links__1__url__value="https://gather.town/terracefclub",
        )
        response = self.client.get(self.url + f"?pk={event.pk}")
        self.assertEqual(
            response.context["links"],
            [
                ("instagram", "https://www.instagram.com/terracefclub"),
                ("facebook", "https://www.facebook.com/"),
                ("zoom", "https://zoom.us/"),
            ],
        )


class EventsFilterViewTest(TestCase):
    def test_missing_fields_invalid(self):
        response = self.client.get(reverse("events_filter") + "?year=2018")
        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "month was not specified in request".encode("UTF-8"),
            response.content,
        )

        response = self.client.get(reverse("events_filter") + "?month=5")
        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "year was not specified in request".encode("UTF-8"),
            response.content,
        )

    def test_socials_valid_results(self):
        event_old = EventFactory(start=timezone.now() - timedelta(days=365))
        event_now = EventFactory(start=timezone.now())
        event_future = EventFactory(start=timezone.now() + timedelta(days=365))

        q_params = {"year": timezone.now().year, "month": timezone.now().month}
        response = self.client.get(
            reverse("events_filter") + "?" + urlencode(q_params)
        )
        self.assertEqual(list(response.context["events"]), [event_now])
        self.assertIn("start__year", response.context)
        self.assertIn("start__month", response.context)

        q_params = {
            "year": (timezone.now() - timedelta(days=365)).year,
            "month": timezone.now().month,
        }
        response = self.client.get(
            reverse("events_filter") + "?" + urlencode(q_params)
        )
        self.assertEqual(list(response.context["events"]), [event_old])

        q_params = {
            "year": (timezone.now() + timedelta(days=365)).year,
            "month": timezone.now().month,
        }
        response = self.client.get(
            reverse("events_filter") + "?" + urlencode(q_params)
        )
        self.assertEqual(list(response.context["events"]), [event_future])
