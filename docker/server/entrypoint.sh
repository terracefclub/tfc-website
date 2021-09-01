#!/bin/ash

MANAGE_PY=$BASEDIR/backend/manage.py

add_gcloud_credentials() {
  echo -n "Updating credentials ... "
  echo $GOOGLE_CREDENTIALS | base64 -d - > $BASEDIR/config/credentials.json
  echo "done"
}


start_cloudsql_proxy() {
  echo -n "Starting Cloud SQL proxy ... "
  cloud_sql_proxy -instances=$SQL_INSTANCE=tcp:5432 &> $BASEDIR/logs/proxy.log &
  echo "done"
}


test_postgres_connection() {
  echo -n "Waiting for postgres ... "
  [ "$STAGE" == "prod" ] && host="127.0.0.1" || host="postgres"
  while ! nc -z $host 5432 &> /dev/null; do sleep 0.1; done
  echo "done"
}

manage_django_init_changes() {
  echo -n "Checking for new migrations from stupid apps (wagtail_nav_menus get rekt) ... "
  python $MANAGE_PY makemigrations 1> /dev/null
  echo "we are chilling!"

  echo -n "Running new database migrations ... "
  python $MANAGE_PY migrate --database default --no-input --check
  echo "done"

  echo -n "Collecting static into staticfiles app ... "
  python $MANAGE_PY collectstatic -l --no-input 1> /dev/null
  echo "done"
}

run_gunicorn_server() {
  ACCESSLOGFILE=$BASEDIR/logs/gunicorn.log
  WSGI=$BASEDIR/backend/wsgi
  NUM_WORKERS=3

  echo "Booting up the server to listen at port ${PORT:-8000} ... "
  gunicorn $WSGI:application \
    --bind=0.0.0.0:${PORT:-8000} \
    --workers=$NUM_WORKERS \
    --access-logfile=$ACCESSLOGFILE \
    --log-file=- \
    --user=$(id -un) \
    --group=$(id -gn) \
    "$@"
}

test_django_server() {
  python $MANAGE_PY test --keepdb
  coverage report
  coverage json
  coverage xml
}

test_frontend() {
  npm --prefix $BASEDIR/frontend run test
}

start() {

  add_gcloud_credentials
  [ "$STAGE" == "prod" ] && start_cloudsql_proxy
  
  test_postgres_connection
  manage_django_init_changes

  if [ "$STAGE" == "prod" ]; then
    run_gunicorn_server
  else
    test_django_server
    test_frontend
  fi
}

"$@"