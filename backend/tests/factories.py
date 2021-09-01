from django.contrib.auth.models import User
from factory import Factory, SubFactory
from factory.django import DjangoModelFactory
from factory.faker import Faker
from factory.helpers import post_generation
from wagtail.core.blocks import (
  StreamBlock, StreamValue, PageChooserBlock, RichTextBlock
)
from wagtail.core.blocks.field_block import RawHTMLBlock
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail_factories import PageFactory
from wagtail_factories.blocks import CharBlockFactory
from wagtail_factories.factories import DocumentFactory

class UserFactory(DjangoModelFactory):
  class Meta:
    model = User
  
  first_name = Faker('first_name')
  last_name = Faker('last_name')
  username = Faker('profile', fields=['username'])
  password = Faker('password', length=14)


class StreamBlockFactory(Factory):
  """ Modeled after StructBlockFactory """
  class Meta:
    model = StreamBlock
  
  @classmethod
  def _build(cls, model_class, *args, **kwargs):
    block = model_class()
    return StreamValue(block, [
      (name, kwargs[name] if name in kwargs else child_block.get_default())\
      for name, child_block in block.child_blocks.items()
    ])

  @classmethod
  def _create(cls, model_class, *args, **kwargs):
    return cls._build(model_class, *args, **kwargs)

class PageChooserBlockFactory(Factory):
  """ 
  TODO: allow specification of subtypes through model_class 
  """
  class Meta:
    model = PageChooserBlock

  page = SubFactory(PageFactory)

  @classmethod
  def _build(cls, model_class, page):
    return page

  @classmethod
  def _create(cls, model_class, page):
    return page


class DocumentChooserBlockFactory(Factory):
  """ 
  TODO: allow specification of subtypes through model_class 
  """
  class Meta:
    model = DocumentChooserBlock

  doc = SubFactory(DocumentFactory)

  @classmethod
  def _build(cls, model_class, doc):
    return doc

  @classmethod
  def _create(cls, model_class, doc):
    return doc

class ChoiceBlockFactory(Factory):
  pass

class RichTextBlockFactory(Factory):
  """
  Implementation taken from https://github.com/nhsuk/wagtail-factories/blob/dev/src/wagtail_factories/blocks.py#L158
  """
  class Meta:
    model = RichTextBlock

  @classmethod
  def _build(cls, model_class, value=""):
    block = model_class()
    return block.to_python(value)

  @classmethod
  def _create(cls, model_class, *args, **kwargs):
    return cls._build(model_class, *args, **kwargs)

class RawHTMLBlockFactory(CharBlockFactory):
  class Meta:
    model = RawHTMLBlock

class TagFactoryMixin(DjangoModelFactory):
  class Meta:
    abstract = True
    
  @post_generation
  def tags(self, create, extracted, **kwargs):
    """ TODO: this may be a different design with Wagtail ClusterTaggableManager """
    if not create: return
    if extracted: # list of tags
      for tag in extracted:
        self.tags.add(tag)
