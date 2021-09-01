from django.template import Template, Context
from django.test import TestCase

class ConcatenateStringsTemplateTagTest(TestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{{ "str1"|addstr:"str2" }}'
    ).render(Context())
    self.assertInHTML('str1str2', html)

class RetrieveDynamicValueTemplateTagTest(TestCase):
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

class EqualsTemplateTagTest(TestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% with is_match=value|equals:"myvalue" %}'
      '{{ is_match }}'
      '{% endwith %}'
    ).render(Context({
      'value': 'myvalue'
    }))
    self.assertInHTML('True', html)

class NotEqualsTemplateTagTest(TestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% with is_match=value|notequals:"myvalue" %}'
      '{{ is_match }}'
      '{% endwith %}'
    ).render(Context({
      'value': 'myvalue'
    }))
    self.assertInHTML('False', html)

class EnvTemplateTagTest(TestCase):
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

class RangeFromNumTemplateTagTest(TestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% for i in 5|range %}'
      '{{ i }}'
      '{% endfor %}'
    ).render(Context())
    self.assertInHTML('01234', html)

class SubtractIntegersTemplateTagTest(TestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '{% with diff=5|subtract:1 %}'
      '{{ diff }}'
      '{% endwith %}'
    ).render(Context())
    self.assertInHTML('4', html)

class RandomNumberTemplateTagTest(TestCase):
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

class TrimDigitsTemplateTagTest(TestCase):
  def test_renders(self):
    html = Template(
      '{% load tags_main %}'
      '<p>{{ 1500|trim_digits }}</p>'
      '<p>{{ 800|trim_digits }}</p>'
      '<p>{{ 12345|trim_digits }}</p>'
    ).render(Context())
    self.assertHTMLEqual(html, '<p>1.5K</p><p>800</p><p>12.3K</p>')


