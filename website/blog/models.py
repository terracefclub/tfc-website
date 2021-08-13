"""
Blog application snippets, page types, and general models.
Supports blog pages, a blog index page, general post tagging, filtering, and adding images.
"""

from django import forms
from django.db import models
import django_filters

from modelcluster.fields import ParentalKey, ParentalManyToManyField
from modelcluster.contrib.taggit import ClusterTaggableManager
from taggit.models import TaggedItemBase

from wagtail.core.models import Page, Orderable
from wagtail.core.blocks import (
  StreamBlock, PageChooserBlock, RawHTMLBlock, RichTextBlock
  )
from wagtail.core.fields import StreamField
from wagtail.admin.edit_handlers import (
  FieldPanel, MultiFieldPanel, StreamFieldPanel
)
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.search import index
from wagtail.snippets.models import register_snippet
from website.base.edit_handlers import InlinePanel

from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator

@register_snippet
class BlogCategory(models.Model):
  """
  Additional snippet for blog category and corresponding icon, if desired, as a more prominent blog type tag
  """
  name = models.CharField(max_length=255)
  icon = models.ForeignKey(
    'wagtailimages.Image', null=True, blank=True, 
    on_delete=models.SET_NULL, related_name='+')

  panels = [
    FieldPanel('name'),
    ImageChooserPanel('icon'),
  ]

  def __str__(self):
    return self.name

  class Meta:
    verbose_name_plural = 'Blog Categories'

class BlogIndexPage(Page):
  """
  Indexing blog pages with a searching filter and rankable sorters.
  Page customization is with <pinned_posts> so that while users are browsing they can be directed towards highlighted blog posts.
  """
  pinned_posts = StreamField(
    StreamBlock([
      ('blog_page', PageChooserBlock('blog.BlogPage'))
    ], max_num=7, required=False),
    default=[]
  )

  # restricts possible child pages to only BlogPage
  parent_page_types = ['base.HomePage']
  subpage_types = ['blog.BlogPage']
  content_panels = Page.content_panels + [
    StreamFieldPanel('pinned_posts', classname='full', heading='Blog Posts to pin on right panel')
  ]

  def blogpages(self):
    """ Get all live blog pages order by most recent first """
    return self.get_children().specific().live().order_by('-first_published_at')

  def get_context(self, request):
    """ Passes blogpages into the page context """
    context = super().get_context(request)
    context['blogpages'] = self.blogpages()

    paginator = Paginator(self.blogpages(), 8)
    page = request.GET.get('page', 1)
    try:
      results = paginator.page(page)
    except PageNotAnInteger:
      results = paginator.page(1)
    except EmptyPage:
      results = paginator.page(paginator.num_pages)

    context['results'] = results
    return context

class BlogPageTag(TaggedItemBase):
  """ Tags for blog pages. Very generically envisioned currently """
  content_object = ParentalKey('BlogPage', related_name='tagged_items', on_delete=models.CASCADE)

class BlogPage(Page):
  """
  Model for an individual page representing a blog post. Each is characterized by a 'date', a summarizing 'introduction', a 'body' RichTextField, various tags, and a many-to-many relationship with BlogCategory.
  """

  date = models.DateField("Post date")
  intro = models.CharField(max_length=250)
  body = StreamField(
    StreamBlock([
      ('text', RichTextBlock()),
      ('html', RawHTMLBlock(help_text='Insert raw HTML for a complicated embed')),
      ('doc', DocumentChooserBlock())
    ], required=False),
    default=[]
  )
  tags = ClusterTaggableManager(through=BlogPageTag, blank=True)
  categories = ParentalManyToManyField('blog.BlogCategory', blank=True)

  @property
  def main_image(self):
    """ Returns the principal image for the blogpage, intend for use in the index page """
    item = self.gallery_images.first()
    return item.image if item else None

  search_fields = Page.search_fields + [
    index.SearchField('intro', partial_match=True, boost=2),
    index.SearchField('body'),
    index.FilterField('tags'),
    index.FilterField('categories'),
    index.RelatedFields('gallery_images', [
      index.SearchField('caption')
    ])
  ]

  content_panels = Page.content_panels + [
    MultiFieldPanel([
      FieldPanel('date'),
      FieldPanel('tags'),
      FieldPanel('categories', widget=forms.CheckboxSelectMultiple),
    ], heading="Blog Information"),
    FieldPanel('intro'),
    StreamFieldPanel('body', classname="full"),

    # include gallery images defined by BlogPageImage
    InlinePanel('gallery_images', label="Gallery Images")
  ] 

class BlogPageFilter(django_filters.FilterSet):
  class Meta:
    # allows wide support for filtering blog pages by date, tags, etc.

    model = BlogPage 
    fields = {
      'date': ['exact', 'lt', 'gt'],
      'tags__name': ['exact']
    }

class BlogPageGalleryImage(Orderable):
  """ Orderable images assigned to blog pages with a specific caption """
  page = ParentalKey(BlogPage, on_delete=models.CASCADE, related_name='gallery_images')
  image = models.ForeignKey('wagtailimages.Image', on_delete=models.CASCADE, related_name='+')
  caption = models.CharField(blank=True, max_length=250)

  panels = [
    ImageChooserPanel('image'),
    FieldPanel('caption')
  ]


class BlogTagIndexPage(Page):
  def get_context(self, request):
    # pass filtered blogpages to the tag index page
    # filter by tag
    tag = request.GET.get('tag')
    f = BlogPageFilter(request.GET, queryset=BlogPage.objects.all())
    
    context = super().get_context(request)
    context['blogpages'] = f.qs
    return context