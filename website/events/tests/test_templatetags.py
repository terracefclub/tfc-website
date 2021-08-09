from datetime import datetime, timedelta
from website.events.models import Event
from django.template import Template, Context
from django.test import TestCase
from django.utils import timezone
from .factories import EventFactory

class EventsTemplateTagsTest(TestCase):
  def test_month_int_to_short_name(self):
    html = Template(
      '{% load tags_events %}'
      '{{ 4|month }}, {{ "11"|month }}'
    ).render()
    self.assertEqual('APR, NOV', html)

  def test_get_multiple_days(self):
    pass

  def test_week_of_month(self):
    html = Template(
      '{% load tags_events %}'
      '{{ datetime1|week_of_month }}, {{ datetime2|week_of_month }}'
    ).render(Context({ 
      'datetime1': datetime.strptime('05-15-2021', '%m-%d-%Y'),
      'datetime2': datetime.strptime('05-16-2021', '%m-%d-%Y')
    }))
    self.assertEqual(html, '2, 3')

  def test_with_date(self):
    today = timezone.now()
    tomorrow = today + timedelta(days=1)
    events_today = EventFactory.build_batch(2, start=today, end=today)
    events_tomorrow = EventFactory.build_batch(2, start=tomorrow, end=tomorrow)
    event_today_to_tomorrow = EventFactory(start=today, end=tomorrow)

    html = Template(
      '{% load tags_events %}'
      '{% for event in events|with_date:today %}'
      '<p>{{ event.name }}</p>'
      '{% endfor %}'
    ).render(Context({ 
      'events': Event.objects.all(),
      'today': today,
      'tomorrow': tomorrow
    }))

    for event in events_today:
      self.assertInHTML(event.name, html)
    for event in events_tomorrow:
      assert event.name not in html
    assert event_today_to_tomorrow.name not in html

    html = Template(
      '{% load tags_events %}'
      '{% for event in events|with_date:tomorrow %}'
      '<p>{{ event.name }}</p>'
      '{% endfor %}'
    ).render(Context({ 
      'events': Event.objects.all(),
      'today': today,
      'tomorrow': tomorrow
    }))

    for event in events_tomorrow:
      self.assertInHTML(event.name, html)
    for event in events_today:
      assert event.name not in html
    assert event_today_to_tomorrow.name not in html

  def test_month_calendar(self):
    pass

  def test_multi_date_events_days_counter(self):
    pass