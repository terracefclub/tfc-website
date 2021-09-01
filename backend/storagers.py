from storages.backends.gcloud import GoogleCloudStorage

class GcloudMediaStorage(GoogleCloudStorage):
  def __init__(self, *args, **kwargs):
    kwargs['location'] = 'media'
    super(GcloudMediaStorage, self).__init__(*args, **kwargs)