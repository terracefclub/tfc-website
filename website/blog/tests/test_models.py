import pytest
from website.blog.tests.factories import BlogIndexPageFactory, BlogPageFactory, BlogPageGalleryImageFactory
from website.base.models import HomePage
from website.blog.models import BlogIndexPage, BlogPage, BlogPageGalleryImage
from website.tests.test_pages import WagtailTestsBase
from django.utils import timezone
from datetime import timedelta

class BlogIndexPageTests(WagtailTestsBase):
  def test_hierarchy(self):
    self.assertAllowedSubpageTypes(parent_model=BlogIndexPage, child_models=[BlogPage])
    self.assertAllowedParentPageTypes(child_model=BlogIndexPage, parent_models=[HomePage])
  
  def test_get_live_blogpages_antichronological(self):
    now = timezone.now()

    index = BlogIndexPageFactory()
    blogpage_latest = BlogPageFactory(parent=index, first_published_at=now)
    blogpage_middle = BlogPageFactory(parent=index, 
      first_published_at=now - timedelta(days=1))
    blogpage_first = BlogPageFactory(parent=index, 
      first_published_at=now - timedelta(days=3))
    blogpage_draft = BlogPageFactory(parent=index, 
      first_published_at=now, live=False)
    blogpage_orphan = BlogPageFactory(first_published_at=now)

    blogpages = list(index.blogpages())
    self.assertNotIn(blogpage_draft, blogpages)
    self.assertNotIn(blogpage_orphan, blogpages)
    self.assertEqual(blogpages, [
      blogpage_latest, blogpage_middle, blogpage_first
    ])

  @pytest.mark.skip(reason="URL is not being created.")
  def test_context(self):
    index = BlogIndexPageFactory()
    blogpages = BlogPageFactory.create_batch(30, parent=index)
    response = self.client.get(index.url)
    self.assertEqual(
      response.context['results'].num_pages, 4
    )
    self.assertEqual(response.context['results'].number, 1)
    for result in response.context['results']:
      self.assertIn(result, blogpages)
    
    response = self.client.get(index.url + '?page=2')
    self.assertEqual(response.context['results'].number, 2)
    for result in response.context['results']:
      self.assertIn(result, blogpages)

@pytest.mark.skip(reason="Unable to mock main_image property with factory_boy. Tried post_generation hook, lazy attributes, being explicit.")
class BlogPageTests(WagtailTestsBase):
  def test_main_image_property(self):
    
    image1 = BlogPageGalleryImageFactory(image__title='Image 1')
    image2 = BlogPageGalleryImageFactory(image__title='Image 2')

    index = BlogPageFactory(gallery_images=[image2, image1])
    self.assertEqual(index.main_image.title, 'Image 2')

    BlogPageGalleryImage.objects.last().delete()
    self.assertEqual(index.main_image.title, 'Image 1')

    BlogPageGalleryImage.objects.first().delete()
    self.assertIsNone(index.main_image)
