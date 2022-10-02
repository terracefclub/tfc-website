import os
from .constants import BASE_DIR

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": " | ".join(
                [
                    "{levelname}",
                    "{asctime}",
                    "Module {module}",
                    "Process {process:d}",
                    "Thread {thread:d}",
                    'Message "{message}"',
                ]
            ),
            "style": "{",  # instead of %() syntax
        },
        "simple": {
            "format": '{levelname} | "{message}"',
            "style": "{",  # instead of %() syntax
        },
    },
    "filters": {
        "require_debug_true": {
            "()": "django.utils.log.RequireDebugTrue",
        },
        "require_debug_false": {
            "()": "django.utils.log.RequireDebugFalse",
        },
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "filters": ["require_debug_true"],
            "formatter": "simple",
        },
        "file": {
            "level": "ERROR",
            "class": "loggers.FileHandler",
            "filters": ["require_debug_false"],
            "formatter": "verbose",
            "filename": os.path.join(BASE_DIR, "logs/django/error.log"),
        },
        "mail_admins": {
            "level": "ERROR",
            "class": "django.utils.log.AdminEmailHandler",
            "filters": ["require_debug_false"],
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django.request": {
            "handlers": ["mail_admins"],
            "level": "ERROR",
            "propagate": False,
        },
        "django.template": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": True,
        },
        "django.db.backends": {
            "handlers": ["file"],
            "level": "ERROR",
            "propagate": True,
        },
        "local": {"handlers": ["console"], "level": "DEBUG"},
        "django": {"handlers": ["file"], "level": "ERROR", "propagate": True},
    },
}
