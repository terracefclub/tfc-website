from datetime import timedelta, datetime
from wagtail_factories.factories import (
    DocumentFactory,
    ImageFactory,
    PageFactory,
)
from tests.factories import TagFactoryMixin
from factory.declarations import (
    LazyAttribute,
    LazyAttributeSequence,
    RelatedFactory,
    Sequence,
    SubFactory,
)
from menus.models import *
from factory.django import DjangoModelFactory
from factory.fuzzy import FuzzyChoice, FuzzyDate
from factory.faker import Faker


class FoodCourseFactory(DjangoModelFactory):
    class Meta:
        model = FoodCourse

    choices = ["soup", "side", "entree", "dessert"]
    name = FuzzyChoice(choices=choices)
    order = LazyAttribute(lambda obj: obj.choices.index(obj.name))

    fooditems = RelatedFactory(
        "menus.tests.factories.FoodItemFactory", factory_related_name="course"
    )


class MenuThemeFactory(DjangoModelFactory):
    class Meta:
        model = MenuTheme

    theme = Faker("country")

    menus = RelatedFactory(
        "menus.tests.factories.MenuFactory", factory_related_name="theme"
    )


class BreweryFactory(DjangoModelFactory):
    class Meta:
        model = Brewery

    name = Sequence(lambda n: f"Beer {n}")
    city = Faker("city")
    state = Faker("state")
    logo_url = Faker("image_url", width=100, height=100)

    beers = RelatedFactory(
        "menus.tests.factories.BeerItemFactory", factory_related_name="brewery"
    )


class BeerStyleFactory(DjangoModelFactory):
    class Meta:
        model = BeerStyle

    style = Sequence(lambda n: f"Style {n}")

    beers = RelatedFactory(
        "menus.tests.factories.BeerItemFactory", factory_related_name="style"
    )


class FoodItemFactory(TagFactoryMixin):
    class Meta:
        model = FoodItem

    name = Sequence(lambda n: f"Food Item {n}")
    description = Faker("paragraph", nb_sentences=5)
    course = SubFactory(FoodCourseFactory)

    images = RelatedFactory(
        "menus.tests.factories.FoodItemImageFactory",
        factory_related_name="food",
    )
    menus = RelatedFactory(
        "menus.tests.factories.MenuFoodItemFactory",
        factory_related_name="food_item",
    )


class FoodItemImageFactory(DjangoModelFactory):
    class Meta:
        model = FoodItemImage

    food = SubFactory(FoodItemFactory)
    image = SubFactory(ImageFactory)
    caption = Faker("text", max_nb_words=250)


class BeerItemFactory(DjangoModelFactory):
    class Meta:
        model = BeerItem

    name = Sequence(lambda n: f"Beer Item {n}")
    brewery = SubFactory(BreweryFactory)
    abv = Faker(
        "pyfloat",
        left_digits=2,
        right_digits=1,
        positive=True,
        min_value=4.0,
        max_value=12.0,
    )
    style = SubFactory(BeerStyleFactory)
    description = Faker("paragraph", nb_sentences=5)

    weeks = RelatedFactory(
        "menus.tests.factories.WeekBeerItemFactory",
        factory_related_name="beer_item",
    )


class MenuIndexPageFactory(PageFactory):
    class Meta:
        model = MenuIndexPage


class WeeklyMenuPageFactory(PageFactory):
    class Meta:
        model = WeeklyMenuPage

    starting_day = FuzzyDate(start_date=datetime(2010, 1, 1).date())
    doc = SubFactory(DocumentFactory)

    menus = RelatedFactory(
        "menus.tests.factories.MenuFactory", factory_related_name="week"
    )
    beer_items = RelatedFactory(
        "menus.tests.factories.WeekBeerItemFactory",
        factory_related_name="page",
    )


class MenuFactory(DjangoModelFactory):
    class Meta:
        model = Menu

    date = LazyAttributeSequence(
        lambda obj, n: obj.week.starting_day + timedelta(days=n - 1)
    )
    theme = SubFactory(MenuThemeFactory)
    week = SubFactory(WeeklyMenuPageFactory)

    food_items = RelatedFactory(
        "menus.tests.factories.MenuFoodItemFactory",
        factory_related_name="menu",
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
    form = FuzzyChoice(["can", "bottle", "keg"])
