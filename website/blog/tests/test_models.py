import pytest
from website.blog.tests.factories import BlogIndexPageFactory, BlogPageFactory
from website.base.models import HomePage
from website.blog.models import BlogIndexPage, BlogPage, BlogPageGalleryImage
from website.tests.test_pages import WagtailTestsBase

class BlogIndexPageTests(WagtailTestsBase):
  def test_hierarchy(self):
    self.assertAllowedSubpageTypes(parent_model=BlogIndexPage, child_models=[BlogPage])
    self.assertAllowedParentPageTypes(child_model=BlogIndexPage, parent_models=[HomePage])
  
  @pytest.mark.skip(reason="Needs to be written without its own sorting logic")
  def test_get_live_blogpages_antichronological(self):
    index = BlogIndexPageFactory()
    blogpages = BlogPageFactory.create_batch(30, parent=index)
    blogpages_final = sorted([
      bp for bp in blogpages if bp.live
    ], key=lambda bp: bp.first_published_at, reverse=True)
    self.assertQuerysetEqual(index.blogpages(), blogpages_final)

  @pytest.mark.skip(reason="Result is not a valid context variable?")
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

@pytest.mark.skip(reason="Must resolve deep streamfield spec first")
class BlogPageTests(WagtailTestsBase):
  def test_main_image_property(self):
    index = BlogPageFactory(
      gallery_images__0__image__title='Image 1',
      gallery_images__1__image__title='Image 2'
    )
    self.assertEqual(index.main_image.title, 'Image 1')

    BlogPageGalleryImage.objects.first().delete()
    self.assertEqual(index.main_image.title, 'Image 2')

    BlogPageGalleryImage.objects.first().delete()
    self.assertIsNone(index.main_image)
