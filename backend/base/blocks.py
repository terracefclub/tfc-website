"""
Standard Wagtail file for defining StreamField blocks for content
creation on specific pages in Wagtail admin.
Primarily used in the 'base' app.
"""

from wagtail.core.blocks import (
  StructBlock, CharBlock, ChoiceBlock, RichTextBlock, StreamBlock
)
from wagtail.embeds.blocks import EmbedBlock
from wagtail.images.blocks import ImageChooserBlock

class HeadingBlock(StructBlock):
  """
  Wagtail block for creating general section headers in StreamField

  :var text: the words written in the heading
  :var size: the options for different heading sizes
  """
  text = CharBlock(required=True)
  size = ChoiceBlock(choices=[
    ('', 'Select a header size'),
    ('h2', 'H2'),
    ('h3', 'H3'),
    ('h4', 'H4')
  ], blank=True, required=False)

  class Meta:
    """ specifies admin display icon and render template """
    icon = 'fa-heading'
    template = 'blocks/heading_block.html'

class ImageBlock(StructBlock):
  """
  Wagtail block for uploading images in StreamField with a caption

  :var image: the image file to include in the block (chosen or uploaded)
  :var caption: the description to include alongside the image
  """
  image = ImageChooserBlock(required=True)
  caption = CharBlock(required=True)

  class Meta:
    """ specifies admin display icon and render template """
    icon = 'fa-image'
    template = 'blocks/image_block.html'

class BodyStreamBlock(StreamBlock):
  """
  Wagtail group block for main content StreamFields (currently employed in the model :model:`base.models.HomePage`)

  :var heading: block for creating headings
  :var paragraph: block for submitting rich text
  :var image: block for selecting images with captions
  :var embed: block for embedding videos outside of paragraph content
  """
  heading = HeadingBlock()
  paragraph = RichTextBlock(icon='fa-paragraph')
  image = ImageBlock()
  embed = EmbedBlock(icon='fa-anchor', help_text='Insert an embed URL')
