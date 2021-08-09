import pytest
from django.utils.translation import activate

@pytest.fixture(autouse=True)
def set_default_language():
  activate('en')

@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
  pass

@pytest.fixture(scope='session', autouse=True)
def faker_seed():
  return 42
