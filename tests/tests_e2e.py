from django.test import LiveServerTestCase

class E2ETests(LiveServerTestCase):

  def test_form_page_submission(self, client, driver):
    pass