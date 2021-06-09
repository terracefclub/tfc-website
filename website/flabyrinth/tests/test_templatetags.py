from django.template import Template, Context
from django.test import TestCase

class FlabyrinthTemplateTagTests(TestCase):
  def test_basepath(self):
    html = Template(
      '{% load flabyrinth_tags %}'
      '{{ url|basepath }}'
    ).render(Context({ 
      'url': 'localhost:8000/flabyrinth/posts/create'
    }))
    self.assertEquals('localhost:8000/flabyrinth/posts', html)