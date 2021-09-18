from django.test import TestCase
from django.core.management import call_command
from distutils.dir_util import copy_tree, remove_tree

from django.conf import settings
import os
import logging
import pytest

app_media = os.path.join(settings.BACKEND_DIR, "media")
data_media = os.path.join(settings.BASE_DIR, "data/media")


@pytest.mark.usefixtures("inject_caplog")
class DumpFixtureTests(TestCase):
    def setUp(self):
        if os.path.isdir(app_media):
            copy_tree(app_media, data_media)
            remove_tree(app_media)
        else:
            self.empty_media = True

    @pytest.mark.order(before="test_fixture_dump_full")
    def test_fixture_dump_empty(self):
        self.caplog.set_level(logging.INFO, logger="local")
        with pytest.raises(FileNotFoundError) as err:
            call_command("dump_fixture")
        self.assertIn(
            'The settings value "MEDIA_ROOT" is invalid', err.value.strerror
        )
        self.assertNotEqual(
            ("local", logging.INFO, "Media files dumped!"),
            self.caplog.record_tuples[-1],
        )

    def test_fixture_dump_full(self):
        self.caplog.set_level(logging.INFO, logger="local")
        copy_tree(data_media, app_media)
        call_command("dump_fixture")
        self.assertEqual(
            ("local", logging.INFO, "Media files dumped!"),
            self.caplog.record_tuples[-1],
        )

    def tearDown(self):
        if not hasattr(self, "empty_media") and not os.path.isdir(app_media):
            copy_tree(data_media, app_media)
        elif self.empty_media and os.path.isdir(app_media):
            remove_tree(app_media)


@pytest.mark.usefixtures("inject_caplog")
class InitMenuAppTests(TestCase):
    def test_init_menu_app(self):
        # create a home page because it should already be created when running
        # this command
        from tests.base.factories import HomePageFactory

        _ = HomePageFactory()

        self.caplog.set_level(logging.INFO, logger="local")
        call_command("init_menu_app")
        self.assertEqual(
            ("local", logging.INFO, "Menus app successfully initialized!"),
            self.caplog.record_tuples[-1],
        )
