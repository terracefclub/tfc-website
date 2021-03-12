from django.test import RequestFactory

from wagtail.core.models import Page, Site
from wagtail.tests.utils import WagtailPageTests, form_data

from website.base.tests.test_models import HomePageFactory, HomePage
from website.blog.tests.test_models import BlogCategoryFactory, BlogPageFactory, BlogIndexPageFactory, BlogPage

class TestPageModels(WagtailPageTests):

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

