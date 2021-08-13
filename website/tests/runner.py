class PytestRunner:
  """ Runs pytest in `manage.py` context to discover and run tests """

  def __init__(self, failfast=False, keepdb=False, parallel=0, **kwargs):
    self.failfast = failfast
    self.keepdb = keepdb
    self.parallel = parallel

  @classmethod
  def add_arguments(cls, parser):
    parser.add_argument('--keepdb', action='store_true', help='Preserves DB')

  def get_coverage_modules(self, labels):
    import re

    modules = set()
    for label in labels:
      module = re.findall(r'((?:[a-zA-Z_\-]+/)+)tests', label)[0][:-1]
      modules.add(module)

    return [f'--cov={module}' for module in modules]

  def run_tests(self, test_labels):
    """ Add CLI arguments to pytest command by what is on manage.py CLI """
    import pytest

    argv = []
    if self.failfast:
      argv.append('--exitfirst')
    if self.keepdb:
      argv.append('--reuse-db')
    if self.parallel > 1:
      argv.append(f'-n {self.parallel}')

    # Coverage references project directory through pytest-cov
    if len(test_labels) > 0:
      argv.extend(self.get_coverage_modules(test_labels))
    else:
      argv.append('--cov=website')

    # Specify new cache directory for pytest
    argv.append('-o cache_dir=.coverage/pytest_cache')

    # Suppress annoying third party warnings calling deprecated functions
    argv.append('-W ignore::django.utils.deprecation.RemovedInDjango40Warning')

    argv.extend(test_labels)
    return pytest.main(argv)