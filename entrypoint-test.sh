#!/bin/bash

set -xe

python manage.py test website/
cd website/frontend && npm run test && cd ../..

coverage report
coverage json

exec "$@"