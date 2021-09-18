from django.apps import AppConfig


class EventsConfig(AppConfig):
    name = "events"

    # once app is ready, initialize the AP Scheduler job for google social
    # events calendar synchronization
    def ready(self):
        from .scheduler import start

        start()
