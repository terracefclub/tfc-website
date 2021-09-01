from datetime import timedelta

### MODELS ###
from django.db.models import Model
from wagtail.core.models import Orderable, Page, ClusterableModel
from wagtail.snippets.models import register_snippet
from wagtail.search.index import Indexed
from taggit.models import TaggedItemBase

### FIELD MGMT ###
from django.db.models import (
  CharField, PositiveSmallIntegerField, URLField, TextField, ForeignKey, 
  DecimalField, DateField, CASCADE, SET_NULL
)
from wagtail.core.fields import RichTextField
from wagtail.search.index import SearchField, FilterField, RelatedFields
from modelcluster.fields import ParentalKey
from modelcluster.contrib.taggit import ClusterTaggableManager

### PANELS ###
from wagtail.admin.edit_handlers import FieldPanel, MultiFieldPanel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.snippets.edit_handlers import SnippetChooserPanel
from wagtail.documents.edit_handlers import DocumentChooserPanel
from base.edit_handlers import InlinePanel


### WIDGETS ###
from django.forms import RadioSelect

__all__ = [
  'FoodCourse', 'FoodTag', 'MenuTheme', 'Brewery', 'BeerStyle', 'FoodItem',
  'FoodItemImage', 'BeerItem', 'MenuIndexPage', 'WeeklyMenuPage',
  'Menu', 'MenuFoodItem', 'WeekBeerItem'
]


@register_snippet
class FoodCourse(Model):
  """
  Snippet for meal courses with a name like 'entree', 'soup', 'dessert', 'side' 
  or whatever other categories are necessary, they can be added
  
  :var name: the name of the food course during a meal
  :var order: position in the menu top down
  """
  name = CharField(max_length=15)
  order = PositiveSmallIntegerField(unique=True, null=True,
    verbose_name="Order of appearance in menu listing")

  def __str__(self):
    return self.name



@register_snippet
class FoodTag(TaggedItemBase):
  """
  Tags for individual 'FoodItem' below such as 'vegan', 'dairy', 'nuts', 
  'vegetarian'. This is a searchable manytomany relation with the necessary(?) 
  keyword 'content_object'
  """
  content_object = ParentalKey('FoodItem', 
    related_name='tagged_items', on_delete=CASCADE)



@register_snippet
class MenuTheme(ClusterableModel):
  """
  Meant to be a pretty open category for evening dinners with a certain 
  specialty. It could be a spotlight cuisine like friday mexican or a special 
  event theme for sophomores or members etc.

  Thoughts? Are these best included as tags? We'd need a better interface for 
  that I feel like. This makes it easy to process then but I am open to 
  restructuring models. TODO NOTE
  """
  theme = CharField(max_length=200)

  panels = [
    FieldPanel('theme')
  ]

  def __str__(self):
    return self.theme



@register_snippet
class Brewery(Indexed, ClusterableModel):
  """
  A Brewery the fine beer chairs have purchased from before. The 'logo_url' is
  just for putting in the brewery logo on display. Could use a redesign
  visually.

  :var name: the name of the brewery
  :var city: the city where the brewery is located
  :var state: the state where the brewery is based
  :var logo_url: a link to a png/jpg/svg to represent the brewery on the page
  """
  class Meta:
    verbose_name_plural = "Fine Beer Breweries"

  name = CharField(max_length=50)
  city = CharField(max_length=25, blank=True, null=True)
  state = CharField(max_length=2, blank=True, null=True)
  logo_url = URLField(blank=True, null=True)

  panels = [
    FieldPanel('name'),
    FieldPanel('city'),
    FieldPanel('state'),
    FieldPanel('logo_url', 
      heading="URL of desired brewery logo", 
      help_text='Just copy image link address into this field')
  ]

  search_fields = [
    SearchField('name'),

    FilterField('city'),
    FilterField('state')
  ]

  def __str__(self):
    return f'{self.name} ({self.city}, {self.state})'



@register_snippet
class BeerStyle(ClusterableModel):
  """
  Snippet for beer style

  :Comments:
  Again, maybe a use case for tags still? Possibly hierarchical ones
  """
  style = CharField(max_length=25)

  panels = [
    FieldPanel('style', heading="Style of the Beer")
  ]

  def __str__(self):
    return self.style
  


@register_snippet
class FoodItem(Indexed, ClusterableModel):
  """
  Snippet for a dish, including its 'name', a 'description' if desired by the 
  food chair or steve. Tag cluster defined here like a ManyToManyField with a 
  builtin admin widget. Images can also be uploaded for each food item to show 
  off what the club makes.

  :var name: the name of the dish that Terrace makes
  :var description: the text description of the dish
  :var tags: mostly standard tags for displaying next to dish names in menus
  :var course: the portion of the meal that the dish belongs too (e.g. soup, ..)
  """
  class Meta:
    verbose_name_plural = "Meal Dishes"

  name = CharField(max_length=100)
  description = TextField(blank=True, null=True)
  tags = ClusterTaggableManager(through=FoodTag, blank=True)
  course = ForeignKey('menus.FoodCourse', 
    on_delete=SET_NULL, null=True, related_name='fooditems')

  panels = [
    MultiFieldPanel([
      FieldPanel('name'),
      FieldPanel('course'),
      FieldPanel('description'),
      FieldPanel('tags'),
    ], heading="Main Information"),
    InlinePanel('images', label="Gallery Images")
  ] 

  search_fields = [
    SearchField('name', partial_match=True, boost=2),
    SearchField('description'),
    RelatedFields('images', [
      SearchField('caption')
    ]),

    FilterField('tags')
  ]

  def __str__(self):
    return f'{self.name} ({self.course})'
  
  @property
  def main_image(self):
    """ Retrieve the primary image to display also as a thumbnail """
    item = self.images.first()
    return item.image if item else None



class FoodItemImage(Orderable):
  """
  Images for a food item and an associated caption. Created simultaneously with 
  food items. 

  :var food: the :model:`menus.FoodItem` instance the image is for
  :var image: the reference to an underlying :model:`wagtailimages.Image` ref
  :var caption: a textual description of the dish image
  """
  food = ParentalKey(FoodItem, on_delete=CASCADE, related_name='images')
  image = ForeignKey('wagtailimages.Image', on_delete=CASCADE, related_name='+')
  caption = CharField(max_length=250, blank=True, null=True)

  panels = [
    ImageChooserPanel('image'),
    FieldPanel('caption')
  ]

@register_snippet
class BeerItem(Indexed, ClusterableModel):
  """
  Snippet for adding beer, typically for fine beer during wednesday dinners. 
  Currently, best to add new beer as a snippet and insert into the page. Assign 
  it to a brewery, including abv values and style and a description if desired. 

  :var name: the name of the beer
  :var brewery: the :model:`menus.Brewery` it is made by
  :var abv: the ABV content
  :var style: the :modeL:`menus.BeerStyle` that the beer is
  :var description: a description of the beer to be shared with membership
  """

  name = CharField(max_length=25)
  brewery = ParentalKey(Brewery, related_name='beers', on_delete=CASCADE)
  abv = DecimalField(decimal_places=1, max_digits=3, blank=True, null=True)
  style = ParentalKey(BeerStyle, related_name='beers', 
    blank=True, null=True, on_delete=SET_NULL)
  description = RichTextField(blank=True, null=True)

  panels = [
    FieldPanel('name'),
    SnippetChooserPanel('brewery'),
    FieldPanel('abv', heading="Percent Alcohol by Volume (ABV %)"),
    SnippetChooserPanel('style'),
    FieldPanel('description')
  ]

  search_fields = [
    SearchField('name', partial_match=True, boost=2),
    SearchField('description'),
    RelatedFields('brewery', [
      SearchField('name')
    ]),

    FilterField('abv'),
  ]

  def __str__(self):
    return f'{self.name} ({self.brewery})'


class MenuIndexPage(Page):
  """
  Used as the parent page for weekly menus. Only accepts
  :model:`models.WeeklyMenuPage` instances as valid subpages.
  """
  subpage_type = ['WeeklyMenuPage']
  

class WeeklyMenuPage(Page):
  """
  The main menu page, showing the dinner menu for an entire week, as well as 
  links to the most recent menus (MAX_RECENT_WEEKLY_MENUS), a fine beer tap 
  area, and an image gallery of the entrees throughout the week.

  :var starting_day: the starting day of the week (for menus, Monday)
  :var doc: the :model:`wagtaildocs.Document` instance, which is a PDF document
    that Steve generates for the weekly menu
  """
  starting_day = DateField("First day of the week (Monday)")
  doc = ForeignKey("wagtaildocs.Document", 
    verbose_name="Menu Document", on_delete=SET_NULL, null=True, blank=True)

  search_fields = Page.search_fields + [
    SearchField('starting_day'),
    RelatedFields('beer_items', [
      SearchField('name')
    ]),

    RelatedFields('menus', [
      FilterField('date'),
    ]),
  ]

  def get_menus(self):
    """ Menus of the week ordered chronologically """
    return self.menus.order_by('date')

  def other_menupages(self):
    """ Retrieves 'neighboring' menu pages for accessing nearby menus easily"""
    before = WeeklyMenuPage.objects\
      .filter(starting_day__lt=self.starting_day)\
      .order_by('-starting_day')
    after = WeeklyMenuPage.objects\
      .filter(starting_day__gte=self.starting_day)\
      .order_by('starting_day')
    
    # Take weekly menus from 'before' and 'after' as lists
    befores = before[:min([before.count(), 3]):1]
    afters = after[:5 - len(befores):-1]

    # Add attributes for frontend use if oldest or newest neighbor
    # is actually the oldest or newest weekly menu in the database
    oldest = WeeklyMenuPage.objects.order_by('starting_day').first()
    newest = WeeklyMenuPage.objects.order_by('starting_day').last()
    if befores[-1] is oldest:
      befores[-1].oldest = True
    if afters[0] is newest:
      afters[0].newest = True

    return afters + befores

  def get_food_gallery(self):
    """ Collect entree images from the week's menus """
    images = []
    for menu in self.menus.all():
      for item in menu.food_items.all():

        # Only use distinct main images for each 'entree' food item included on
        # the week's menus
        image = item.food_item.main_image
        if image and\
           item.food_item.course.name == "entree" and\
           image not in [image['image'] for image in images]:

          # Also list the weekdays with this item on the menu
          dates = item.food_item.menus\
            .filter(menu__date__gte=self.starting_day)\
            .filter(menu__date__lt=self.starting_day + timedelta(days=7))\
            .distinct()\
            .values_list('menu__date', flat=True)
          weekdays = [date.strftime('%A') for date in sorted(dates)]
          
          # images in the gallery are passed in context as the wagtail image, 
          # a list of ordered weekdays with the dish, and the name of the dish
          images.append({ 
            'image': image, 
            'weekdays': weekdays, 
            'name': item.food_item.name })
    return images

  content_panels = Page.content_panels + [
    FieldPanel('starting_day'),
    DocumentChooserPanel('doc', heading='Full Menu Document'),
    InlinePanel('menus', label="Daily Menus", max_num=7, min_num=1),
    InlinePanel('beer_items', heading="Fine Beer Options"),
  ]

class Menu(ClusterableModel, Orderable, Indexed):
  """
  A single dinner menu, created and ordered simultaneously with the weekly menu
  page containing it. Food items can be added simultaneously to this menu when
  building the page.

  :var date: the day the meal occurs on
  :var theme: the :model:`menus.MenuTheme` instance for the day's menu
    (this is like Friday's being Mexican or Wednesday's international)
  :var week: the :model:`menus.MenuWeeklyPage` instance the menu is part
    of (daily menus don't have their own page, but are shown with the rest)
  """
  date = DateField('Date of Meal', unique=True)
  theme = ParentalKey(MenuTheme, 
    on_delete=SET_NULL, blank=True, null=True, related_name='menus')
  week = ParentalKey(WeeklyMenuPage, on_delete=CASCADE, related_name='menus')

  panels = [
    FieldPanel('date'),
    InlinePanel('food_items', heading="Food Items"),
    SnippetChooserPanel('theme', heading="Theme for the day (if any)")
  ]

  search_fields = [
    FilterField('date'),
    RelatedFields('theme', [
      FilterField('theme')
    ])
  ]

class MenuFoodItem(Orderable):
  """
  Orderable instance of a food item being added to the menu.
  Used in tandem with a Food Item snippet instead of a ParentalManyToManyField
  to allow for easier item selecting and creation on the weekly menu page

  :var menu: the :model:`menus.Menu` the dish is used on
  :var food_item: the actual :model:`menus.FoodItem` being added to menu
  """
  class Meta:
    # to ensure unique food items per menu
    unique_together = ('menu', 'food_item')

  menu = ParentalKey(Menu, on_delete=CASCADE, related_name='food_items')
  food_item = ParentalKey(FoodItem, on_delete=CASCADE, related_name='menus')

  panels = [

    # (I think this is not true anymore with InlinePanel fix?)
    # this panel is being rendered as a typical FieldPanel unfortunately
    # known bug at https://github.com/wagtail/wagtail/issues/5770 regarding 
    # nested InlinePanels. will attempt a hacky fix at a later point
    SnippetChooserPanel('food_item')
  ]



class WeekBeerItem(Orderable, Indexed):
  """
  Equivalent orderable unique instance of beer assigned to a weekly page (not to
  a specific menu). The beer form can be specified too as a can, bottle, or keg 
  for a nice graphic

  :var page: the :model:`menus.WeeklyMenuPage` the fine beer is on menu
  :var beer_item: the actual :model:`menus.BeerItem` used on the page
  :var form: whether the beer will be served from cans, bottles, or via tap/keg
  """
  class Meta:
    # to ensure unique beers for the week
    unique_together = ('page', 'beer_item')

  page = ParentalKey(WeeklyMenuPage, 
    on_delete=CASCADE, related_name='beer_items')
  beer_item = ParentalKey(BeerItem, on_delete=CASCADE, related_name='weeks')
  form = CharField(choices=[
    ('can', 'Can'),
    ('bottle', 'Bottle'),
    ('keg', 'Keg')
  ], default='keg', max_length=10)

  panels = [
    SnippetChooserPanel('beer_item'),
    FieldPanel('form', widget=RadioSelect)
  ]

  search_fields = [
    RelatedFields('beer_item', [
      SearchField('name')
    ]), 

    FilterField('form'),
  ]