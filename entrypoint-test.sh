#!/bin/bash

set -xe

python manage.py test website/
npm run test

coverage report
coverage json

exec "$@"