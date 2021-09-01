#!/bin/bash
set -eux

# Backend testing
python manage.py test --keepdb

# Frontend testing
npm --prefix ./frontend run test

# Generate backend reports
coverage report
coverage json

exec "$@"