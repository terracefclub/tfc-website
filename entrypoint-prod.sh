set -xe

python manage.py collectstatic --noinput
gunicorn website.wsgi:application

exec "$@"