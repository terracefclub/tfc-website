from factory import SubFactory, Sequence
from factory.fuzzy import FuzzyChoice
from website.base.blocks import BodyStreamBlock, HeadingBlock, ImageBlock
from ..models import FormPage, HomePage, SimplePage

from wagtail_factories import (
  ImageChooserBlockFactory, StructBlockFactory, CharBlockFactory, 
  StreamFieldFactory, PageFactory
)
from website.tests.factories import RawHTMLBlockFactory, RichTextBlockFactory, StreamBlockFactory, PageChooserBlockFactory



class HeadingBlockFactory(StructBlockFactory):
  class Meta:
    model = HeadingBlock
  text = SubFactory(CharBlockFactory)
  size = FuzzyChoice(['h2', 'h3', 'h4'])

class ImageBlockFactory(StructBlockFactory):
  class Meta:
    model = ImageBlock
  image = SubFactory(ImageChooserBlockFactory)
  caption = SubFactory(CharBlockFactory)

class BodyStreamBlockFactory(StreamBlockFactory):
  class Meta:
    model = BodyStreamBlock
  heading = SubFactory(HeadingBlockFactory)
  paragraph = SubFactory(RichTextBlockFactory)
  image = SubFactory(ImageBlockFactory)

class HomePageFactory(PageFactory):
  class Meta:
    model = HomePage
  
  title = Sequence(lambda x: f'Home Page {x}')
  pinned_posts = StreamFieldFactory({
      'page': PageChooserBlockFactory
  })
  body = StreamFieldFactory({ 'body_stream_block': BodyStreamBlock })

class SimplePageFactory(PageFactory):
  class Meta:
    model = SimplePage
  body = StreamFieldFactory({
    'html': RawHTMLBlockFactory,
    'text': RichTextBlockFactory
  })

class FormPageFactory(PageFactory):
  class Meta:
    model = FormPage
  