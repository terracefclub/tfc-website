#!/bin/ash

echo -n "Updating credentials ... "
echo $GOOGLE_CREDENTIALS | base64 -d - > /usr/src/womb/config/credentials.json
echo "done"

echo -n "Starting Cloud SQL proxy ... "
cloud_sql_proxy -instances=$SQL_INSTANCE=tcp:5432 &> /usr/src/womb/logs/proxy.log &
echo "done"

echo -n "Waiting for postgres ... "
while ! nc -z 127.0.0.1 5432; do
  sleep 0.1
done
echo "done"

start() {
  ACCESSLOGFILE=/usr/src/womb/logs/gunicorn/access.log
  NUM_WORKERS=3

  echo -n "Checking for new migrations from stupid apps (wagtail_nav_menus get rekt) ... "
  python manage.py makemigrations 1> /dev/null
  echo "we are chilling!"

  echo -n "Running new database migrations ... "
  python manage.py migrate --database default --no-input --check
  echo "done"

  echo -n "Collecting static into staticfiles app ... "
  python manage.py collectstatic -l --no-input 1> /dev/null
  echo "done"

  echo "Booting up the server to listen at port ${PORT:-8000} ..."
  gunicorn wsgi:application \
    --bind=0.0.0.0:${PORT:-8000} \
    --workers=$NUM_WORKERS \
    --access-logfile=$ACCESSLOGFILE \
    --log-file=- \
    --user=$(id -un) \
    --group=$(id -gn) \
    "$@"
}

"$@"