from django.test import TestCase, override_settings
from django.urls import reverse

from wagtail_factories import ImageFactory
from wagtail_factories.factories import DocumentFactory
from website.events.tests.factories import MediaFactory

from django.conf import settings

class MediaArchiveViewTests(TestCase):
  def test_no_media_items(self):
    response = self.client.get(reverse('archive'))
    self.assertEqual(response.status_code, 200)
    for model_name in ['newsletters', 'menus', 'audio', 'video', 'murals']:
      self.assertContains(response, f'No {model_name} available.')
      self.assertQuerysetEqual(response.context['data'][model_name], [])

  def test_display_some_items(self):
    murals = ImageFactory.build_batch(5, tags__0__name='mural')
    docs = DocumentFactory.build_batch(6, tags__0__name='menu')
    newsletters = DocumentFactory.build_batch(3, tags__0__name='newsletter')
    audio = MediaFactory.build_batch(2)
    video = MediaFactory.build_batch(2, type='video')
    
    response = self.client.get(reverse('archive'))
    for model_name, instances in zip(['murals', 'docs', 'newsletters', 'audio', 'video'], [murals, docs, newsletters, audio, video]):
      self.assertNotContains(response, f'No {model_name} available.')
      self.assertQuerysetEqual(response.context['data'][model_name], instances)

  @override_settings(MAX_ITEMS_DEFAULT_BASE=10)
  def test_display_many_items_truncation(self):
    max_items = settings.MAX_ITEMS_DEFAULT_BASE

    murals = ImageFactory.build_batch(15, tags__0__name='mural')
    docs = DocumentFactory.build_batch(15, tags__0__name='menu')
    newsletters = DocumentFactory.build_batch(15, tags__0__name='newsletter')
    audio = MediaFactory.build_batch(3)
    video = MediaFactory.build_batch(3, type='video')
    
    response = self.client.get(reverse('archive'))
    for model_name, instances in zip(['murals', 'docs', 'newsletters', 'audio', 'video'], [murals, docs, newsletters, audio, video]):
      self.assertNotContains(response, f'No {model_name} available.')
      self.assertQuerysetEqual(response.context['data'][model_name], instances[:min(max_items, len(instances))])

class SearchViewTests(TestCase):
  pass
