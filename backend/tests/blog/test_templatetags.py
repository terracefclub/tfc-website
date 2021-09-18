from django.template import Template, Context
from django.test import TestCase


class BlogTemplateTagsTest(TestCase):
    def test_page_count(self):
        html = Template("{% load tags_blog %}" "{{ 31|page_count }}").render(
            Context()
        )
        self.assertEqual("4", html)
