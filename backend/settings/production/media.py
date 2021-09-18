import os
import json
import base64
from ..base.constants import BACKEND_DIR
from google.oauth2 import service_account

__all__ = [
    "MEDIA_ROOT",
    "MEDIA_URL",
    "DEFAULT_FILE_STORAGE",
    "GS_PROJECT_ID",
    "GS_BUCKET_NAME",
    "GS_CREDENTIALS",
]

MEDIA_ROOT = os.path.join(BACKEND_DIR, "media")
MEDIA_URL = "/media/"

DEFAULT_FILE_STORAGE = "storagers.GcloudMediaStorage"
GS_PROJECT_ID = "terracefclub"
GS_BUCKET_NAME = "tfc-media-bucket"
# GS_DEFAULT_ACL = 'publicRead'  # returns public, non-expiring URL

creds = base64.b64decode(os.environ.get("GOOGLE_CREDENTIALS", "")).decode(
    "utf-8"
)
GS_CREDENTIALS = service_account.Credentials.from_service_account_info(
    json.loads(creds)
)
