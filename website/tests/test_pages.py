import pytest

from wagtail.core.models import Page, Site
from wagtail.tests.utils import WagtailPageTests

from website.base.tests.test_models import HomePageFactory

from django.apps import apps

@pytest.mark.django_db
class WagtailTestsBase(WagtailPageTests):

  @classmethod
  def setUpClassData(cls):
    super(WagtailTestsBase, cls).seUpClass()
    cls.first_root = Page.get_first_root_node()
    cls.site = Site.objects.create(
      is_default_site=True, root_page=cls.first_root
    )

    cls.homepage = HomePageFactory()
    cls.site.root_page = cls.homepage

    cls.site.save()

  def assertNotAllowedSubpageTypes(self, parent_model, child_models, msg=None):

    def get_model(model):
      if isinstance(model, str):
        return apps.get_model(*model.split('.'))
      return model

    parent = get_model(parent_model)
    children = map(get_model, child_models)

    self.assertNotEquals(
      set(parent.allowed_subpage_models()),
      set(children), msg=msg
    )