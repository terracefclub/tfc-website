set -xe

python manage.py migrate --noinput
coverage run --source='.' manage.py test website
coverage report

exec "$@"