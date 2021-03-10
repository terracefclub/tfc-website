from django.db import models
from django import forms
from modelcluster.fields import ParentalKey, ParentalManyToManyField
from modelcluster.contrib.taggit import ClusterTaggableManager
from taggit.models import TaggedItemBase

from wagtail.search import index
from wagtail.core.models import Orderable, Page
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.admin.edit_handlers import FieldPanel, InlinePanel, MultiFieldPanel
from wagtail.snippets.models import register_snippet

@register_snippet
class FoodCourse(models.Model):
  name = models.CharField(max_length=15)

  def __str__(self):
    return self.name

@register_snippet
class FoodTag(TaggedItemBase):
  content_object = ParentalKey('FoodItem', related_name='tagged_items', on_delete=models.CASCADE)

@register_snippet
class Brewery(models.Model):
  name = models.CharField(max_length=50)
  city = models.CharField(max_length=25, blank=True, null=True)
  state = models.CharField(max_length=2, blank=True, null=True)

  panels = [
    FieldPanel('name'),
    FieldPanel('city'),
    FieldPanel('state')
  ]

  def __str__(self):
    return f'{self.name} -- {self.city}, {self.state}'
  
  class Meta:
    verbose_name_plural = "Fine Beer Breweries"

@register_snippet
class BeerStyle(models.Model):
  style = models.CharField(max_length=25)

  panels = [
    FieldPanel('style')
  ]

  def __str__(self):
    return self.style
  
  class Meta:
    verbose_name_plural = "Beer Styles"

@register_snippet
class FoodItem(models.Model):
  name = models.CharField(max_length=75)
  description = models.TextField(blank=True, null=True)
  tags = ClusterTaggableManager(through=FoodTag, blank=True)
  course = models.ForeignKey('website.menus.FoodCourse', on_delete=models.SET_NULL, related_name='fooditems')

  content_panels = Page.content_panels + [
    MultiFieldPanel([
      FieldPanel('name'),
      FieldPanel('description'),
      FieldPanel('tags'),
    ], heading="Main Information"),
    InlinePanel('images', label="Gallery Images")
  ] 

  def __str__(self):
    return self.name
  
  @property
  def main_image(self):
    item = self.images.first()
    return item.image or None
  
  class Meta:
    verbose_name_plural = "Meal Dishes"


class FoodItemImage(Orderable):
  food = ParentalKey(FoodItem, on_delete=models.CASCADE, related_name='images')
  image = models.ForeignKey('wagtailimages.Image', on_delete=models.CASCADE, related_name='+')
  caption = models.CharField(blank=True, null=True, max_length=250)

  panels = [
    ImageChooserPanel('image'),
    FieldPanel('caption')
  ]


class MenuPage(Page):
  date = models.DateField('Date of Meal')
  items = ParentalManyToManyField('website.menus.FoodItem', blank=True, null=True)

  search_fields = Page.search_fields + [
    index.SearchField('items'),
  ]

  def week_menus(self):
    before3 = MenuPage.objects.filter(date__lt=self.date).order_by('date')[-3:]
    after3 = MenuPage.objects.filter(date__gt=self.date).order_by('date')[:3]
    return before3 + after3

  content_panels = Page.content_panels + [
    FieldPanel('date'),
    FieldPanel('items', widget=forms.ModelForm)
  ]

@register_snippet
class MenuTheme(models.Model):
  theme = models.CharField(max_length=50)
  menu = ParentalKey(Menu, on_delete=models.SET_NULL, related_name='menus')

  panels = [
    FieldPanel('theme')
  ]

  def __str__(self):
    return self.theme
  
  class Meta:
    verbose_name_plural = "Menu Themes"

