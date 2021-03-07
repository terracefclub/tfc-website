import factory 
from ..models import HomePage

from wagtail.core.models import Page

class PageFactory(factory.django.DjangoModelFactory):
  class Meta:
    abstract = True
  
  @classmethod #overriding _create for page parent-child relationship
  def _create(cls, model_class, *args, **kwargs):
    parent = kwargs.pop('parent', Page.get_first_root_node())
    page = model_class(*args, **kwargs)
    parent.add_child(instance=page)
    return page

class HomePageFactory(PageFactory):
  class Meta:
    model = HomePage
  
  title = factory.Sequence(lambda x: f'Home Page {x}')