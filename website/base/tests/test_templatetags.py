from django.template import Template, Context
from django.test import SimpleTestCase

from website.menus.tests.factories import WeeklyMenuPageFactory

class ConcatenateStringsTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{{ "str1"|addstr:"str2" }}'
    ).render()
    self.assertInHTML('str1str2', html)

class RetrieveDynamicValueTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% with key="mykey" %}'
      '{{ mydict|get:key }}'
      '{% endwith %}'
    ).render(Context({
      'mydict': { 'mykey': 'myvalue' }
    }))
    self.assertInHTML('myvalue', html)

class EqualsTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% with is_match=value|equals:"myvalue" %}'
      '{{ answer }}'
      '{% endwith %}'
    ).render(Context({
      'value': 'myvalue'
    }))
    self.assertInHTML('True', html)

class NotEqualsTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% with is_match=value|notequals:"myvalue" %}'
      '{{ answer }}'
      '{% endwith %}'
    ).render(Context({
      'value': 'myvalue'
    }))
    self.assertInHTML('False', html)

class EnvTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    import os
    os.environ['mykey'] = 'myvalue'

    html = Template(
      '{% load tags_main %}'
      '{{ key|env }}'
    ).render(Context({
      'key': 'mykey'
    }))
    self.assertInHTML('myvalue', html)

class RangeFromNumTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% for i in 5|range %}'
      '{{ i }}'
      '{% endfor %}'
    ).render()
    self.assertInHTML('01234', html)

class SubtractIntegersTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% with diff=5|subtract:1 %}'
      '{{ diff }}'
      '{% endwith %}'
    ).render()
    self.assertInHTML('4', html)

class RandomNumberTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% random upper_bound %}'
      '{% random upper_bound %}'
      '{% random upper_bound %}'
      '{% random upper_bound %}'
      '{% random upper_bound %}'
    ).render(Context({
      'upper_bound': 10
    }))
    self.assertRegex(html, r'[1-9]{5}')

class MostRecentMenuTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    menu_page = WeeklyMenuPageFactory()
    html = Template(
      '{% load tags_main %}'
      '{% most_recent_menu as week_menus %}'
      '{{ week_menus.title }}'
    ).render()
    self.assertInHTML(menu_page.title, html)

    new_menu_page = WeeklyMenuPageFactory()
    new_html = Template(
      '{% load tags_main %}'
      '{% most_recent_menu as week_menus %}'
      '{{ week_menus.title }}'
    ).render()
    self.assertInHTML(new_menu_page.title, new_html)
    self.assertHTMLNotEqual(menu_page.title, new_html)

class TrimDigitsTemplateTagTest(SimpleTestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '<p>{{ 1500|trim_digits }}</p>'
      '<p>{{ 800|trim_digits }}</p>'
      '<p>{{ 12345|trim_digits }}</p>'
    ).render()
    self.assertHTMLEqual(html, '<p>1.5K</p><p>800</p><p>123.4K</p>')


