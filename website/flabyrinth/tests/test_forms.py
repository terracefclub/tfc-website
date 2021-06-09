from django.shortcuts import reverse
from django.test import TestCase, Client

from ..forms import RegistrationForm

class TestRegistrationForm(TestCase):

  def test_form_valid_data(self):
    form = RegistrationForm()
    self.assertTrue(form.is_valid())

  def test_form_no_data(self):
    form = RegistrationForm()
    self.assertFalse(form.is_valid())
    self.assertEquals(len(form.errors), 5) # num of required fields