
from datetime import timedelta
from .test_pages import WagtailTestsBase
from menus.tests.factories import WeeklyMenuPageFactory
from django.utils import timezone
import pytest

@pytest.mark.skip(reason="Randomly aborts, need to investigate more")
class HomePageComponentsTest(WagtailTestsBase):

  def test_get_current_menupage(self):
    now = timezone.now()
    monday = now - timedelta(days=now.weekday())

    this_menu_page = WeeklyMenuPageFactory(starting_day=monday.date())
    last_menu_page = WeeklyMenuPageFactory(
      starting_day=(monday - timedelta(days=7)).date()
    )
    future_menu_page = WeeklyMenuPageFactory(
      starting_day=(monday + timedelta(days=7)).date()
    )
    
    self.assertEqual(self.homepage.get_current_menupage(), this_menu_page)

    this_menu_page.delete()
    self.assertEqual(self.homepage.get_current_menupage(), last_menu_page)
    
    last_menu_page.delete()
    self.assertNotEqual(self.homepage.get_current_menupage(), future_menu_page)
    self.assertIsNone(self.homepage.get_current_menupage())
