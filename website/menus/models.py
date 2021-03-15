from django.db import models
from django import forms
from modelcluster.fields import ParentalKey, ParentalManyToManyField
from modelcluster.contrib.taggit import ClusterTaggableManager
from taggit.models import TaggedItemBase

from wagtail.search import index
from wagtail.core.fields import RichTextField
from wagtail.core.models import Orderable, Page, ClusterableModel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.admin.edit_handlers import FieldPanel, InlinePanel, MultiFieldPanel, StreamFieldPanel
from wagtail.snippets.models import register_snippet
from wagtail.snippets.edit_handlers import SnippetChooserPanel


@register_snippet
class FoodCourse(index.Indexed, models.Model):
  name = models.CharField(max_length=15)

  def __str__(self):
    return self.name

@register_snippet
class FoodTag(TaggedItemBase):
  content_object = ParentalKey('FoodItem', related_name='tagged_items', on_delete=models.CASCADE)

@register_snippet
class MenuTheme(index.Indexed, ClusterableModel):
  theme = models.CharField(max_length=50)

  panels = [
    FieldPanel('theme')
  ]

  def __str__(self):
    return self.theme
  
  class Meta:
    verbose_name_plural = "Menu Themes"

@register_snippet
class Brewery(index.Indexed, ClusterableModel):
  name = models.CharField(max_length=50)
  city = models.CharField(max_length=25, blank=True, null=True)
  state = models.CharField(max_length=2, blank=True, null=True)
  logo_url = models.URLField(default="https://princetonterraceclub.org/wp-content/uploads/2018/08/tfc-badge.png")

  panels = [
    FieldPanel('name'),
    FieldPanel('city'),
    FieldPanel('state'),
    FieldPanel('logo_url', heading="URL of desired brewery logo")
  ]

  def __str__(self):
    return f'{self.name} -- {self.city}, {self.state}'
  
  class Meta:
    verbose_name_plural = "Fine Beer Breweries"

@register_snippet
class BeerStyle(index.Indexed, ClusterableModel):
  style = models.CharField(max_length=25)

  panels = [
    FieldPanel('style', heading="Style of the Beer")
  ]

  def __str__(self):
    return self.style
  
  class Meta:
    verbose_name_plural = "Beer Styles"

@register_snippet
class FoodItem(index.Indexed, ClusterableModel):
  name = models.CharField(max_length=75)
  description = models.TextField(blank=True, null=True)
  tags = ClusterTaggableManager(through=FoodTag, blank=True)
  course = models.ForeignKey('menus.FoodCourse', on_delete=models.SET_NULL, null=True, related_name='fooditems')

  panels = [
    MultiFieldPanel([
      FieldPanel('name'),
      FieldPanel('course'),
      FieldPanel('description'),
      FieldPanel('tags'),
    ], heading="Main Information"),
    InlinePanel('images', label="Gallery Images")
  ] 

  def __str__(self):
    return f'{self.name} ({self.course})'
  
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

@register_snippet
class BeerItem(index.Indexed, ClusterableModel):
  name = models.CharField(max_length=25)
  brewery = ParentalKey(Brewery, related_name='beers', on_delete=models.CASCADE)
  abv = models.DecimalField(decimal_places=1, max_digits=3)
  style = ParentalKey(BeerStyle, related_name='beers', blank=True, null=True, on_delete=models.SET_NULL)
  description = RichTextField(null=True, blank=True)

  panels = [
    FieldPanel('name'),
    SnippetChooserPanel('brewery'),
    FieldPanel('abv', heading="Percent Alcohol by Volume (ABV %)"),
    SnippetChooserPanel('style'),
    FieldPanel('description')
  ]

  def __str__(self):
    return f'{self.name} ({self.style} - {self.abv}) : {self.brewery}'

class WeeklyMenuPage(Page):
  starting_day = models.DateField("First day of the week (Monday)")

  search_fields = Page.search_fields + [
    index.SearchField('starting_day'),
    index.SearchField('menus'),
  ]

  def get_menus(self):
    return self.menus.order_by('date')

  def recent_menus(self):
    MAX_RECENT_MENUS = 10
    previous = WeeklyMenuPage.objects\
      .filter(monday__date__lt=self.monday.date)\
      .order_by('-monday.date')
    return previous[:min(len(previous), MAX_RECENT_MENUS)]

  content_panels = Page.content_panels + [
    FieldPanel('starting_day'),
    InlinePanel('menus', label="Daily Menu", max_num=7, min_num=1)
  ]

class Menu(ClusterableModel, Orderable):
  date = models.DateField('Date of Meal', unique=True)
  theme = ParentalKey(MenuTheme, on_delete=models.SET_NULL, blank=True, null=True, related_name='menus')
  week = ParentalKey(WeeklyMenuPage, on_delete=models.CASCADE, related_name='menus')

  panels = [
    FieldPanel('date'),
    InlinePanel('food_items', heading="Food Items"),
    InlinePanel('beer_items', heading="Fine Beer Options"),
    SnippetChooserPanel('theme', heading="Theme for the day (if any)")
  ]

class MenuFoodItem(Orderable):
  menu = ParentalKey(Menu, on_delete=models.CASCADE, related_name='food_items')
  food_item = models.ForeignKey(FoodItem, on_delete=models.CASCADE, related_name='menus')

  panels = [

    # this panel is being rendered as a typical FieldPanel unfortunately
    # known bug at https://github.com/wagtail/wagtail/issues/5770 regarding nested InlinePanels
    # will attempt a hacky fix at a later point
    SnippetChooserPanel('food_item')
  ]

  class Meta:
    unique_together = ('menu', 'food_item')

class MenuBeerItem(Orderable):
  menu = ParentalKey(Menu, on_delete=models.CASCADE, related_name='beer_items')
  beer_item = models.ForeignKey(BeerItem, on_delete=models.CASCADE, related_name='menus')

  panels = [

    # same thing here as with 'food_item' above
    SnippetChooserPanel('beer_item')
  ]

  class Meta:
    unique_together = ('menu', 'beer_item')