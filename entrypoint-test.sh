#!/bin/bash

set -xe

coverage run python manage.py test website
coverage run npm run test
coverage report

exec "$@"