from datetime import timedelta
from wagtail_factories.factories import DocumentFactory, ImageFactory, PageFactory
from website.tests.factories import TagFactoryMixin
from factory.declarations import LazyAttribute, LazyAttributeSequence, RelatedFactory, Sequence, SubFactory
from ..models import *
from factory.django import DjangoModelFactory
from factory.fuzzy import FuzzyChoice
from factory.faker import Faker

class FoodCourseFactory(DjangoModelFactory):
  class Meta:
    model = FoodCourse
  choices = ['soup', 'side', 'entree', 'dessert']
  name = FuzzyChoice(choices=choices)
  order = LazyAttribute(lambda obj: choices.index(obj.name))

  fooditems = RelatedFactory(
    'website.menus.tests.factories.FoodItemFactory', 
    factory_related_name='course', action=FoodItem.ACTION_CREATE
  )

class MenuThemeFactory(DjangoModelFactory):
  class Meta:
    model = MenuTheme
  theme = Faker('country')

  menus = RelatedFactory(
    'website.menus.tests.factories.MenuFactory', 
    factory_related_name='theme', 
    action=Menu.ACTION_CREATE
  )

class BreweryFactory(DjangoModelFactory):
  class Meta:
    model = Brewery
  name = Sequence(lambda n: f'Beer {n}')
  city = Faker('city')
  state = Faker('state')
  logo_url = Faker('image_url', width=100, height=100)

  beers = RelatedFactory(
    'website.menus.tests.factories.BeerItemFactory', 
    factory_related_name='brewery', action=BeerItem.ACTION_CREATE
  )

class BeerStyleFactory(DjangoModelFactory):
  class Meta:
    model = BeerStyle
  style = Sequence(lambda n: f'Style {n}')

  beers = RelatedFactory(
    'website.menus.tests.factories.BeerItemFactory', 
    factory_related_name='style', action=BeerItem.ACTION_CREATE
  )

class FoodItemFactory(TagFactoryMixin):
  class Meta:
    model = FoodItem
  name = Sequence(lambda n: f'Food Item {n}')
  description = Faker('paragraph', nb_sentences=5)
  course = SubFactory(FoodCourseFactory)

  images = RelatedFactory(
    'website.menus.tests.factories.FoodItemImageFactory', 
    factory_related_name='food', action=FoodItemImage.ACTION_CREATE
  )
  menus = RelatedFactory(
    'website.menus.tests.factories.MenuFoodItemFactory', 
    factory_related_name='food_item', action=MenuFoodItem.ACTION_CREATE
  )

class FoodItemImageFactory(DjangoModelFactory):
  class Meta:
    model = FoodItemImage
  food = SubFactory(FoodItemFactory)
  image = SubFactory(ImageFactory)
  caption = Faker('text', max_nb_words=250)

class BeerItemFactory(DjangoModelFactory):
  class Meta:
    model = BeerItem
  name = Sequence(lambda n: f'Beer Item {n}')
  brewery = SubFactory(BreweryFactory)
  abv = Faker('pyfloat', 
    left_digits=2, right_digits=1, positive=True, min_value=4.0, max_value=12.0
  )
  style = SubFactory(BeerStyleFactory)
  description = '<p>' + Faker('paragraph', nb_sentences=5) + '</p>'

  weeks = RelatedFactory(
    'website.menus.tests.factories.WeekBeerItemFactory', 
    factory_related_name='beer_item', action=WeekBeerItem.ACTION_CREATE
  )

class MenuIndexPageFactory(PageFactory):
  class Meta:
    model = MenuIndexPage

class WeeklyMenuPageFactory(PageFactory):
  class Meta:
    model = WeeklyMenuPage
  starting_day = Faker('date')
  doc = SubFactory(DocumentFactory)

  menus = RelatedFactory(
    'website.menus.tests.factories.MenuFactory', 
    factory_related_name='week', action=Menu.ACTION_CREATE
  )
  beer_items = RelatedFactory(
    'website.menus.tests.factories.WeekBeerItemFactory', 
    factory_related_name='page', action=WeekBeerItem.ACTION_CREATE
  )

class MenuFactory(DjangoModelFactory):
  class Meta:
    model = Menu
  date = LazyAttributeSequence(
    lambda obj, n: obj.factory_parent.starting_day + timedelta(days=n-1)
  )
  theme = SubFactory(MenuThemeFactory)
  week = SubFactory(WeeklyMenuPageFactory)

  food_items = RelatedFactory(
    'website.menus.tests.factories.MenuFoodItemFactory', 
    factory_related_name='menu', action=MenuFoodItem.ACTION_CREATE
  )

class MenuFoodItemFactory(DjangoModelFactory):
  class Meta:
    model = MenuFoodItem
  menu = SubFactory(MenuFactory)
  food_item = SubFactory(FoodItemFactory)

class WeekBeerItemFactory(DjangoModelFactory):
  class Meta:
    model = WeekBeerItem
  page = SubFactory(WeeklyMenuPageFactory)
  beer_item = SubFactory(BeerItemFactory)
  form = FuzzyChoice(['can', 'bottle', 'keg'])