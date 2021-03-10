#!/bin/bash
curl -sL https://deb.nodesource.com/setup_14.x | bash -
apt update
apt-get update
apt-get install --yes --quiet --no-install-recommends build-essential nodejs gdal-bin libpq-dev python3-dev