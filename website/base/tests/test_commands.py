from io import StringIO
from django.test import TestCase
from django.core.management import call_command

class DumpFixtureTests(TestCase):
  def test_fixture_dump(self):
    out = StringIO()
    call_command('dump_fixture', stdout=out)
    self.assertIn('', out.getvalue())

class InitMenuAppTests(TestCase):
  def test_init_menu_app(self):
    # create a home page because it should already be created when running this command
    from website.base.tests.factories import HomePageFactory
    _ = HomePageFactory()
    
    out = StringIO()
    call_command('init_menu_app', stdout=out)
    self.assertIn('', out.getvalue())
