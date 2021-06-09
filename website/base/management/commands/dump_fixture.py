import os
import shutil
import logging

from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.management import call_command


logger = logging.getLogger(__name__)

class Command(BaseCommand):
  """
  CLI command on 'manage.py' for dumping all database models into the fixtures directory, overwriting the previous files. Media files are also transferred.

  TODO: iterate through directory and only copy different files or those with atleast the same edit date (filesystem traversal and shutil.copy)
  """
  def handle(self, **options):
    fixtures_dir = os.path.join(settings.PROJECT_DIR, 'base/fixtures')
    fixtures_file = os.path.join(fixtures_dir, 'fixtures.json')

    # use the builtin ``python manage.py dumpdata`` command to generate JSON
    with open(fixtures_file, 'w') as file:
      logging.info('Writing models as JSON to a fixtures file in "base".')
      call_command('dumpdata', format='json', indent=4, stdout=file)
      logging.info('Models successfully dumped!')

    # copy the locally served ``/media/`` directory to keep together with JSON
    logging.info('Copying the media directory for data synchronization')
    shutil.copytree(settings.MEDIA_ROOT, fixtures_dir)
    logging.info('Media files dumped!')