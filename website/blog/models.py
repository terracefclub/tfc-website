from django import forms
from django.db import models
import django_filters

from modelcluster.fields import ParentalKey, ParentalManyToManyField
from modelcluster.contrib.taggit import ClusterTaggableManager
from taggit.models import TaggedItemBase

from wagtail.core.models import Page, Orderable
from wagtail.core.fields import RichTextField
from wagtail.admin.edit_handlers import FieldPanel, InlinePanel, MultiFieldPanel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.search import index
from wagtail.snippets.models import register_snippet

@register_snippet
class BlogCategory(models.Model):
  name = models.CharField(max_length=255)
  icon = models.ForeignKey(
    'wagtailimages.Image', null=True, blank=True, 
    on_delete=models.SET_NULL, related_name='+')
  
  # no actual 'content'/'promote'/'settings' pannels for snippets
  panels = [
    FieldPanel('name'),
    ImageChooserPanel('icon'),
  ]

  def __str__(self):
    return self.name

  class Meta:
    verbose_name_plural = 'Blog Categories'

class BlogIndexPage(Page):
  intro = RichTextField(blank=True)

  subpage_type = ['BlogPage']
  content_panels = Page.content_panels + [
    FieldPanel('intro', classname="full")
  ]

  def blogpages(self):
    return self.get_children().live().order_by('-first_published_at')

  def get_context(self, request):
    context = super().get_context(request)
    context['blogpages'] = self.blogpages()
    return context

class BlogPageTag(TaggedItemBase):
  content_object = ParentalKey('BlogPage', related_name='tagged_items', on_delete=models.CASCADE)

class BlogPage(Page):
  date = models.DateField("Post date")
  intro = models.CharField(max_length=250)
  body = RichTextField(blank=True)
  tags = ClusterTaggableManager(through=BlogPageTag, blank=True)
  categories = ParentalManyToManyField('blog.BlogCategory', blank=True)

  @property
  def main_image(self):
    item = self.gallery_images.first()
    return item.image or None

  search_fields = Page.search_fields + [
    index.SearchField('intro'),
    index.SearchField('body'),
    index.SearchField('tags'),
    index.SearchField('categories')
  ]

  content_panels = Page.content_panels + [
    MultiFieldPanel([
      FieldPanel('date'),
      FieldPanel('tags'),
      FieldPanel('categories', widget=forms.CheckboxSelectMultiple),
    ], heading="Blog Information"),
    FieldPanel('intro'),
    FieldPanel('body', classname="full"),
    InlinePanel('gallery_images', label="Gallery Images")
  ] 

class BlogPageFilter(django_filters.FilterSet):
  class Meta:
    model = BlogPage 
    fields = {
      'date': ['exact', 'lt', 'gt'],
      'tags__name': ['exact']
    }

class BlogPageGalleryImage(Orderable):
  page = ParentalKey(BlogPage, on_delete=models.CASCADE, related_name='gallery_images')
  image = models.ForeignKey('wagtailimages.Image', on_delete=models.CASCADE, related_name='+')
  caption = models.CharField(blank=True, max_length=250)

  panels = [
    ImageChooserPanel('image'),
    FieldPanel('caption')
  ]


class BlogTagIndexPage(Page):
  def get_context(self, request):
    # filter by tag
    #tag = request.GET.get('tag')
    f = BlogPageFilter(request.GET, queryset=BlogPage.objects.all())
    # update template context
    context = super().get_context(request)
    context['blogpages'] = f.qs
    return context