
from datetime import timedelta
from website.tests.factories import UserFactory
from website.base.tests.factories import FormPageFactory
from .test_pages import WagtailTestsBase
from website.base.models import FormPage, HomePage
from website.menus.tests.factories import WeeklyMenuPageFactory



def get_most_recent_monday():
  from django.utils import timezone
  now = timezone.now()
  return now - timedelta(days=now.weekday())

class HomePageComponentsTest(WagtailTestsBase):

  def test_get_current_menupage(self):
    this_menu_page = WeeklyMenuPageFactory(
      starting_day=get_most_recent_monday()
    )
    last_menu_page = WeeklyMenuPageFactory(
      starting_day=get_most_recent_monday() - timedelta(days=7)
    )
    future_menu_page = WeeklyMenuPageFactory(
      starting_day=get_most_recent_monday() + timedelta(days=7)
    )
    
    self.assertEquals(
      self.homepage.get_current_menupage(),
      this_menu_page
    )

    this_menu_page.delete()
    self.assertEquals(
      self.homepage.get_current_menupage(),
      last_menu_page
    )
    
    last_menu_page.delete()
    self.assertNotEquals(
      self.homepage.get_current_menupage(),
      future_menu_page
    )
    self.assertIsNone(self.homepage.get_current_menupage())

class FormPageSubmissionHandlingTests(WagtailTestsBase):

  def create_test_user(self, **kwargs):
    return UserFactory(**kwargs)

  def test_form_page_supports_submission_limits_on_users(self, client):
    """ TODO: fix this test """
    """
    user = self.create_test_user()
    client.force_login(user)

    data = {}

    form_page = FormPageFactory(is_private=True, max_submissions_per_user=2)

    for i in range(2):
      post_response = client.post(form_page.url, data)
      get_response = client.get(form_page.url)

      self.assertContains() # empty field forms
    """
    pass
