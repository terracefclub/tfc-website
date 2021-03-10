from django.test import TestCase, RequestFactory

from wagtail.core.models import Page, Site
from wagtail.tests.utils import WagtailPageTests, form_data

from website.base.tests.test_models import HomePageFactory, HomePage
from website.blog.tests.test_models import BlogCategoryFactory, BlogPageFactory, BlogIndexPageFactory, BlogPage

class TestPageModels(TestCase, WagtailPageTests):

  @classmethod
  def setUpTestData(cls):
    cls.factory = RequestFactory()
    cls.site = Site.objects.create(is_default_site=True, root_page=Page.get_first_root_node())

    cls.homepage = HomePageFactory()
    cls.category1 = BlogCategoryFactory()
    cls.category2 = BlogCategoryFactory()
    cls.blogindexpage1 = BlogIndexPageFactory(parent=cls.homepage)
    cls.blogpage1 = BlogPageFactory(parent=cls.blogindexpage1, categories=(cls.category1, cls.category2,))
    cls.blogpage2 = BlogPageFactory(parent=cls.blogindexpage1, categories=(cls.category2,))

  def test_blogpages_on_blogindexpage_antichronological(self):
    blogpages = self.blogindexpage1.blogpages()
    dates = [page.first_published_at for page in blogpages]
    self.assertTrue(dates == sorted(dates, reverse=True))

  def test_can_pin_blogpages_to_homepage(self):
    self.assertCanCreate(self.site.root_page, HomePage, form_data.nested_form_data({
      'title': 'Home Page 1',
      'pinned_posts': form_data.streamfield([
        ('page', self.blogpage1), 
        ('page', self.blogpage2)]),
    }))
    self.assertEqual(len(self.homepage.pinned_posts), 0)

  def test_cant_create_blogpage_under_homepage(self):
    self.assertCanNotCreateAt(HomePage, BlogPage)
  
