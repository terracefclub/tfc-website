set -xe

python manage.py migrate --noinput --database default
python manage.py loaddata fixture data/datadump.json
gunicorn website.wsgi:application

exec "$@"