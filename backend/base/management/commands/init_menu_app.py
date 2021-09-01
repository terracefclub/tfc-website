

from django.core.management.base import BaseCommand
from django.core.management import call_command

import json
import re
import os
from datetime import datetime, timedelta

import logging
logger = logging.getLogger('local')

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from taggit.models import Tag
from wagtail.documents.models import Document
from base.models import HomePage
from menus.models import (
  FoodCourse, MenuTheme, MenuFoodItem, FoodItem, MenuIndexPage, WeeklyMenuPage,
  Menu, FoodTag
)

class Command(BaseCommand):
  """ 
  Script to initialize the `menus` application by importing existing dinner menu
  documents and previously extracted JSON into `menus` models.
  """
  def handle(self, **options):

    # retrieve root MenuIndexPage, creating it if not already initialized
    root = MenuIndexPage.objects.first()
    if not root:
      home = HomePage.objects.first()
      menuindexpage_contenttype = ContentType.objects.get_for_model(MenuIndexPage)
      index = MenuIndexPage(
        title="Menu Search",
        slug="menus",
        show_in_menus=True,
        content_type=menuindexpage_contenttype)
      home.add_child(instance=index)
      root = MenuIndexPage.objects.first()
    
    weeklymenupage_contenttype = ContentType.objects.get_for_model(WeeklyMenuPage)
    
    logger.info('Loading data files...')

    # read JSON data in on dinner menu contents
    # ``dates`` is a dictionary of PDF filenames mapped to the Monday they
    # began on
    data_dir = os.path.join(settings.BASE_DIR, 'data')
    with open(os.path.join(data_dir, 'data.json'), 'r') as file:
      data = json.load(file)
    with open(os.path.join(data_dir, 'dates.json'), 'r') as file:
      dates = json.load(file)
    date_to_filename = {date:filename for filename, date in dates.items()}

    logger.info('Data file load successful! Creating FoodCourse ...')

    # Register main FoodCourse snippets for basic dinner meal structure
    for i, course in enumerate(['soup', 'entree', 'side', 'dessert']):
      FoodCourse.objects.get_or_create(name=course, order=i+1)[0]

    logger.info('FoodCourse creation successful! Adding main data')

    for day in data:
      theme = MenuTheme.objects.get_or_create(theme=day['theme'])[0] if 'theme' in day else None
      today = datetime.strptime(day['date'], '%Y-%m-%d')
      monday = today - timedelta(days=today.weekday())

      # retrieve or initialize the :model:`menus.WeeklyMenuPage`
      # with the PDF document and ``starting_day`` from the ``dates`` mapping
      week = WeeklyMenuPage.objects.filter(starting_day=monday.date()).first()
      if not week:
        filename = re.sub(r'[\(\)]', '', 
          date_to_filename[monday.strftime('%Y-%m-%d')].replace(' ', '_'))
        doc = Document.objects.filter(file=f'documents/{filename}').first()
        week = WeeklyMenuPage(
          title=f'Dinner Menu Week of {monday.strftime("%b %d, %Y")}',
          slug=f'menu-{monday.strftime("%Y-%m-%d")}',
          show_in_menus=True,
          content_type=weeklymenupage_contenttype,
          starting_day=monday.date(),
          doc=doc)
        root.add_child(instance=week)
        week = WeeklyMenuPage.objects.filter(starting_day=monday.date()).first()

      # create dishes and tag relationships
      food_items = [FoodItem.objects.get_or_create(
        name=dish['name'], description='', 
        course=FoodCourse.objects.filter(name=dish['type']).first()
      )[0] for dish in day['dishes']]
      food_tags = [FoodTag.objects.get_or_create(
        tag=Tag.objects.get_or_create(name=tag)[0],
        content_object=item
      )[0] for dish, item in zip(day['dishes'], food_items)\
        for tag in dish['tags']]
      
      # initialize the menu with a date, theme, and assign it to the week
      menu = Menu.objects.get_or_create(
        date=today.date(), theme=theme, week=week
      )[0]

      print('Today\'s date: ', today.date())

      # map the dishes to the initialized menu
      menu_food_items = [MenuFoodItem.objects.get_or_create(
        menu=menu, food_item=item
      )[0] for item in food_items]
      
      # TODO: figure out what the point of this was lol
      #menu = Menu.objects.get_or_create(
      #  date=today.date(), theme=theme, week=week,
      #  food_items=StreamValue(
      #    StreamBlock([('dish', SnippetChooserBlock('menus.FoodItem'))]), 
      #    [('dish', item) for item in food_items])
      #)[0]
      
      
      logger.info(f'Menu data for {today.date()} added! Data dump at menu_data/{today.date()}.json!')

      # save information on imported theme, menu, and page for the week's menus
      with open(os.path.join(data_dir, f'menu_data/{today.date()}.json'), 'w') as file:
        json.dump({
          name: value.to_json() if value else value\
          for name, value in [
            ('menuTheme', theme),
            ('menu', menu),
            ('weeklyMenuPage', week),
          ] if value
        }, file, indent=4)
    
    logger.info('Menus app successfully initialized!')