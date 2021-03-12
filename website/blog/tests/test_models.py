import factory 
from datetime import timedelta
from django.utils import timezone

from ..models import BlogPage, BlogCategory, BlogIndexPage
from wagtail_factories import PageFactory, ImageFactory

class BlogCategoryFactory(factory.django.DjangoModelFactory):
  class Meta:
    model = BlogCategory
  name = factory.Sequence(lambda x: f'Blog Category {x}')
  icon = factory.SubFactory(ImageFactory)

class BlogIndexPageFactory(PageFactory):
  class Meta:
    model = BlogIndexPage
  title = factory.Sequence(lambda x: f'Blog Index {x}')

class BlogPageFactory(PageFactory):
  class Meta:
    model = BlogPage
  
  title = factory.Sequence(lambda x: x)
  date = factory.Sequence(lambda x: timezone.now() - timedelta(days=365-x))
  intro = "Default Intro"
  
  @factory.post_generation
  def categories(self, create, extracted, **kwargs):
    if not create: return
    if extracted:
      for category in extracted:
        self.categories.add(category)
