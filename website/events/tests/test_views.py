from django.test import TestCase
from django.urls import reverse
from urllib.parse import urlencode
# from wagtail.tests.utils.form_data import streamfield
from .factories import EventFactory
from django.utils import timezone
from datetime import timedelta

class EventDetailViewTest(TestCase):
  def test_context(self):
    event = EventFactory()
    response = self.client.get(reverse('event_detail') + f'?pk={event.pk}')
    self.assertEquals(response.status_code, 200)
    self.assertEquals(response.context['event'], event)
    self.assertContains(response, event.name)

  def test_empty_context(self):
    response = self.client.get(reverse('event') + f'?pk=1')
    self.assertEquals(response.status_code, 200)
    self.assertIsNone(response.context['event'])
    self.assertContains(response, "Please select an event in the calendar view to see more information.")

class EventSocialsViewTest(TestCase):

  def setUp(self):
    super().setUp()
    self.event = EventFactory(
      links__stream_block__url__0='https://www.instagram.com/terracefclub',
      links__stream_block__url__1='https://www.facebook.com/terracefclub',
      links__stream_block__url__2='https://zoom.us/tfc',
      links__stream_block__url__3='https://gather.town/terracefclub'
    )
    self.url = reverse('event_socials')

  def test_socials_default(self):
    response = self.client.get(self.url + f'?pk={self.event.pk}')
    self.assertEquals(response.context['links'], [
      'https://www.instagram.com/terracefclub',
      'https://www.facebook.com/terracefclub',
      'https://zoom.us/tfc'
    ])

  def test_socials_three_specific(self):
    response = self.client.get(self.url + '?' + urlencode({
      'pk': self.event.pk, 'social': ['gather.town', 'facebook', 'zoom']
    }))
    self.assertEquals(response.context['links'], [
      'https://gather.town/terracefclub',
      'https://www.facebook.com/terracefclub',
      'https://zoom.us/tfc'
    ])

  def test_socials_missing_skipped(self):
    response = self.client.get(self.url + '?' + urlencode({
      'pk': self.event.pk, 'social': ['reddit', 'zoom']
    }))
    self.assertEquals(response.context['links'], [
      'https://zoom.us/tfc'
    ])

  def test_socials_missing_to_default(self):
    event = EventFactory(
      links__stream_block__url__0='https://www.instagram.com/terracefclub',
      links__stream_block__url__1='https://gather.town/terracefclub'
    )
    response = self.client.get(self.url + f'?pk={event.pk}')
    self.assertEquals(response.context['links'], [
      'https://www.facebook.com',
      'https://www.instagram.com/terracefclub'
      'https://zoom.us/'
    ])

class EventsFilterViewTest(TestCase):
  def test_missing_fields_invalid(self):
    response = self.client.get(reverse('events_filter') + '?year=2018')
    self.assertEquals(response.status_code, 400)
    self.assertContains(response, 'month was not specified in request')

    response = self.client.get(reverse('events_filter') + '?month=5')
    self.assertEquals(response.status_code, 400)
    self.assertContains(response, 'year was not specified in request')

  def test_socials_valid_results(self):
    event_old = EventFactory(start=timezone.now() - timedelta(days=365))
    event_now = EventFactory(start=timezone.now())
    event_future = EventFactory(start=timezone.now() + timedelta(days=365))

    response = self.client.get(reverse('events_filter') + '?' + urlencode({
      'year': timezone.now().year, 'month': timezone.now().month
    }))
    self.assertQuerysetEqual(response.context['events'], [event_now])
    self.assertIn('start__year', response.context)
    self.assertIn('start__month', response.context)

    response = self.client.get(reverse('events_filter') + '?' + urlencode({
      'year': timezone.now().year - timedelta(days=365), 
      'month': timezone.now().month
    }))
    self.assertQuerysetEqual(response.context['events'], [event_old])
    
    response = self.client.get(reverse('events_filter') + '?' + urlencode({
      'year': timezone.now().year + timedelta(days=365), 
      'month': timezone.now().month
    }))
    self.assertQuerysetEqual(response.context['events'], [event_future])