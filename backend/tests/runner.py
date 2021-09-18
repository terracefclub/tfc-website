from django.test.runner import DiscoverRunner
from django.conf import settings


class PytestRunner(DiscoverRunner):
    """Runs pytest in `manage.py` context to discover and run tests"""

    def __init__(self, failfast=False, keepdb=False, parallel=0, **kwargs):
        self.failfast = failfast
        self.keepdb = keepdb
        self.parallel = parallel

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument(
            "--keepdb",
            action="store_true",
            help="Preserves the test DB between runs.",
        )

    def run_tests(self, test_labels):
        """Add CLI arguments to pytest command by what is on manage.py CLI"""
        import pytest
        import os

        argv = []
        if self.failfast:
            argv.append("--exitfirst")
        if self.keepdb:
            argv.append("--reuse-db")
        if self.parallel > 1:
            argv.append(f"-n {self.parallel}")

        # Coverage references project directory through pytest-cov
        if len(test_labels) == 0:
            test_labels = ["base/", "blog/", "events/", "menus/"]

        argv.extend([f"--cov={label}" for label in test_labels])

        argv.append("--cov-config=tests/.coveragerc")
        cov_path = os.path.join(settings.BACKEND_DIR, "tests", ".coverage")
        os.makedirs(cov_path, exist_ok=True)

        # Suppress annoying third party warnings calling deprecated functions
        argv.append(
            "-W ignore::django.utils.deprecation.RemovedInDjango40Warning"
        )

        # only two tests can fail before it stops
        argv.append("--maxfail=2")

        argv.extend([f"tests/{label}" for label in test_labels])
        return pytest.main(argv)
