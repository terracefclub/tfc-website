import os
import logging
import errno
from distutils.dir_util import copy_tree
from distutils.errors import DistutilsFileError

from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.management import call_command


logger = logging.getLogger("local")


class Command(BaseCommand):
    """
    CLI command on 'manage.py' for dumping all database models into the fixtures
    directory, overwriting the previous files. Media files are also transferred.

    TODO: iterate through directory and only copy different files or those with
    atleast the same edit date (filesystem traversal and shutil.copy)
    """

    def handle(self, **options):

        # use the builtin ``python manage.py dumpdata`` command to generate JSON
        logger.info('Writing models as JSON to a fixtures file in "base".')
        fixtures_file = os.path.join(settings.BASE_DIR, "data/fixtures.json")
        with open(fixtures_file, "w") as file:
            call_command("dumpdata", format="json", indent=4, stdout=file)
        logger.info("Models successfully dumped!")

        # copy the locally served `/media/` directory to keep together with JSON
        logger.info("Copying the media directory for data synchronization")
        data_media_dir = os.path.join(settings.BASE_DIR, "data/media")

        try:
            copy_tree(settings.MEDIA_ROOT, data_media_dir)
        except DistutilsFileError:
            raise FileNotFoundError(
                errno.ENOENT,
                (
                    'The settings value "MEDIA_ROOT" is invalid because the '
                    f"directory {settings.MEDIA_ROOT} does not exist. "
                    "Initialize this empty directory and transfer any media"
                    "files needed for development."
                ),
            )
        logger.info("Media files dumped!")
