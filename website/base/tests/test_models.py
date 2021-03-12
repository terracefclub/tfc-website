import factory 
from wagtail_factories import PageFactory
from ..models import HomePage

from wagtail.core.models import Page

class HomePageFactory(PageFactory):
  class Meta:
    model = HomePage
  
  title = factory.Sequence(lambda x: f'Home Page {x}')