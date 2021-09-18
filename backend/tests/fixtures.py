import pytest


@pytest.fixture(scope="function")
def inject_caplog(request, caplog):
    request.cls.caplog = caplog
