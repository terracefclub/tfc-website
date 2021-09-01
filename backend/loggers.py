import logging
import os
from settings.base.constants import BASE_DIR

class FileHandler(logging.FileHandler):
  def __init__(self, filename, mode='a', encoding=None, delay=0):
    path = os.path.join(BASE_DIR, 'logs/django')
    os.makedirs(path, exist_ok=True)
    super(FileHandler, self).__init__(filename, mode, encoding, delay)
