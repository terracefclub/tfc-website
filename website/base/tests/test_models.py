from wagtail.core.models import Page
from website.tests.test_pages import WagtailTestsBase

from ..models import FormPage, HomePage, SimplePage, get_all_page_types
from .factories import FormPageFactory


""" TODO: Converter for handling `nested_form_data` to wagtail_factories """

class BaseWagtailUnits(WagtailTestsBase):

  def test_home_page_hierarchy(self):
    self.assertAllowedParentPageTypes(
      child_model=HomePage, parent_models=[Page]
    )
    self.assertNotAllowedSubpageTypes(
      parent_model=HomePage,
      child_models=[HomePage, 'blog.blogpage', 'menus.weeklymenupage']
    )

  def test_simple_page_hierarchy(self):
    self.assertNotAllowedSubpageTypes(
      SimplePage,
      child_models=get_all_page_types()
    )

class BaseDjangoUnits(WagtailTestsBase):
  def test_form_page_queryset(self):
    public_pages = FormPageFactory.create_batch(5) # is_private=False

    public_pages_query = FormPage.objects.public()
    self.assertEqual(public_pages, list(public_pages_query))
    for page in public_pages_query: 
      self.assertFalse(page.is_private)
