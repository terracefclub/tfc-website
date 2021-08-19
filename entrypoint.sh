#!/bin/bash

set -xe

# tried to use gosu tool to run container with better permissions management 
# than sudo, but it wasn't working (never actually gave the user permissioned 
# access to key commands ...)
# set -- gosu -u ${FULL_USERNAME} "$@"

if [ "$STAGE" == "development" ]; then
  while sleep 1000; do :; done
elif [ "$STAGE" == "testing" ]; then
  # Backend testing
  python manage.py test website/

  # Frontend testing
  cd website/frontend
  npm run test
  cd ../..

  # Generate backend reports
  coverage report
  coverage json
elif [ "$STAGE" == "production" ]; then
  # create all application server static directories
  python manage.py collectstatic --noinput

  # Run any database migrations (django) on the default prod server instance
  python manage.py migrate --noinput --database default

  # run production python server
  gunicorn website.wsgi:application
fi

exec "$@"