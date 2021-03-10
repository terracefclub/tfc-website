from django.db import models

from wagtail.core.models import Page
from wagtail.core.fields import RichTextField, StreamField
from wagtail.admin.edit_handlers import FieldPanel, MultiFieldPanel, StreamFieldPanel

from wagtail.core.blocks import StructBlock, CharBlock, ChoiceBlock, RichTextBlock, StreamBlock, PageChooserBlock
from wagtail.embeds.blocks import EmbedBlock
from wagtail.images.blocks import ImageChooserBlock

from website.blog.models import BlogPage

class HeadingBlock(StructBlock):
  """
  Custom block for section headers etc.
  """
  text = CharBlock(required=True)
  size = ChoiceBlock(choices=[
    ('', 'Select a header size'),
    ('h2', 'H2'),
    ('h3', 'H3'),
    ('h4', 'H4')
  ], blank=True, required=False)

  class Meta:
    icon = 'fa-heading'
    template = 'blocks/heading_block.html'

class ImageBlock(StructBlock):
  """
  Custom image block with caption
  """
  image = ImageChooserBlock(required=True)
  caption = CharBlock(required=True)

  class Meta:
    icon = 'fa-image'
    template = 'blocks/image_block.html'

class BodyStreamBlock(StreamBlock):
  """
  Defines the blocks to be used in a default StreamField
  """
  heading = HeadingBlock()
  paragraph = RichTextBlock(icon='fa-paragraph')
  image = ImageBlock()
  embed = EmbedBlock(icon='fa-anchor', help_text='Insert an embed URL')

class HomePage(Page):
  """
  The homepage split into the following major sections:
  1. Pinned Posts
  2. Current Week's Menu
  3. Club Interest Hero
  4. Main Content
  5. Digital Tour
  6. Gear Promotion
  """
  pinned_posts = StreamField(
    StreamBlock([
      ('page', PageChooserBlock(page_type=BlogPage))
    ], template='blocks/carousel.html', required=False),
    blank=True, null=True)
  body = StreamField(BodyStreamBlock(), verbose_name="Home Body", blank=True)
  content_panels = Page.content_panels + [
    StreamFieldPanel('pinned_posts', heading='Pinned Posts'),
    StreamFieldPanel('body', heading="Additional Content"),
  ]
