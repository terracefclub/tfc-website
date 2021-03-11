#!/bin/bash
apt update
apt-get update
apt-get install --yes --quiet --no-install-recommends build-essential gdal-bin libpq-dev python3-dev git curl
curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
apt-get install --yes --quiet nodejs
pip install -r requirements.txt