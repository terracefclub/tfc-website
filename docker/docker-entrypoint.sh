#!/bin/bash
set -xe

python manage.py migrate --noinput

# WARNING:
#   Migrating database at the same time as starting the server IS NOT THE BEST
#   PRACTICE. The database should be migrated manually or using the release
#   phase facilities of your hosting platform. This is used only so the
#   Wagtail instance can be started with a simple "docker run" command.
gunicorn website.wsgi:application

exec "$@"