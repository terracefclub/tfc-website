from django.test import TestCase

from ..models import FlabyrinthPostPage

class PostModelTest(TestCase):
  def test_time_mixin(self):
    post = FlabyrinthPostPage()
    post.save()
    self.assertEqual(post.created_at, post.updated_at)

    post.content = 'new info'
    post.save()
    self.assertGreater(post.updated_at, post.created_at)