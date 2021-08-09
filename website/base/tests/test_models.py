from wagtail.core.models import Page
from website.tests.test_pages import WagtailTestsBase

from ..models import FormPage, HomePage, SimplePage, get_all_page_types
from .factories import FormPageFactory


""" TODO: Converter for handling `nested_form_data` to wagtail_factories """

class BaseWagtailUnits(WagtailTestsBase):

  def test_home_page_hierarchy(self):
    self.assertAllowedParentPageTypes(
      child_model=HomePage, parent_models=[Page, None]
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
    private_pages = FormPageFactory.build_batch(5, is_private=True)
    public_pages = FormPageFactory.build_batch(5) # is_private=False

    private_pages_query = FormPage.objects.private()
    public_pages_query = FormPage.objects.public()

    self.assertEqual(private_pages, private_pages_query)
    self.assertEqual(public_pages, public_pages_query)

    for page in private_pages_query: 
      self.assertTrue(page.is_private)
    for page in public_pages_query: 
      self.assertTrue(page.is_private)
