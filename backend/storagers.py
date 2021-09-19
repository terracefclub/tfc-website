from storages.backends.gcloud import GoogleCloudStorage
from django.core.files.storage import FileSystemStorage
from settings.base.constants import BACKEND_DIR
import os


class GcloudMediaStorage(GoogleCloudStorage):
    def __init__(self, *args, **kwargs):
        kwargs["location"] = "media"
        super(GcloudMediaStorage, self).__init__(*args, **kwargs)


temp_storage = FileSystemStorage(
    location=os.path.join(BACKEND_DIR, "tmp"),
    base_url="",
    file_permissions_mode=0o644,
    directory_permissions_mode=0o644,
)
