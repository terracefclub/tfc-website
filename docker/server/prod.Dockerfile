FROM node AS frontend
COPY frontend/package*.json .
RUN npm install
COPY frontend .
RUN npm run build


FROM python:3.9-alpine
ARG username=forkman
ARG groupname=chillers
ARG WORKDIR=/usr/src/womb
ARG nocache=""
ARG PROXY_BINARY="https://storage.googleapis.com/cloudsql-proxy/v1.21.0/cloud_sql_proxy.linux.amd64"

WORKDIR $WORKDIR
SHELL ["/bin/ash", "-eux", "-o", "pipefail", "-c"]
RUN \
    # Install system build dependencies into virtual folder
    apk add $nocache --virtual .build-deps \
      linux-headers \
      gcc \
      libc-dev \
      musl-dev \
      postgresql-dev \
      python3-dev \
      jpeg-dev \
      zlib-dev \
      libffi-dev; \
    # Install system runtime dependencies
    apk add $nocache \
      postgresql-libs \
      libjpeg \
      geos \
      gdal;
COPY backend/requirements backend/requirements
RUN \
    # Install python dependencies
    pip install --upgrade pip; \
    pip install $nocache --no-deps -r backend/requirements/prod.txt; \
    # Remove system build dependencies
    apk --purge del .build-deps;
RUN \
    # Create runtime user
    addgroup -S $groupname; \
    adduser -D -S $username $groupname; \
    # Create extra directories
    mkdir -p $WORKDIR/logs/gunicorn $WORKDIR/logs/django $WORKDIR/config; \
    chown -R $username:$groupname $WORKDIR; \
    # Add cloud SQL proxy binary
    wget $PROXY_BINARY -O /usr/local/bin/cloud_sql_proxy; \
    chmod +x /usr/local/bin/cloud_sql_proxy;

COPY --chown=$username:$groupname --from=frontend static frontend/static
COPY --chown=$username:$groupname . .

# Support impromptu migration for STUPID apps
# looking at you wagtail_nav_menus!!!!!
RUN chown -R $username:$groupname /usr/local/lib/python3.9/site-packages/wagtail_nav_menus/migrations

USER $username
WORKDIR $WORKDIR/backend
ENV WORKDIR=$WORKDIR/backend \
    DJANGO_SETTINGS_MODULE=settings.prod \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SQL_INSTANCE=terracefclub:us-east1:tapinator
EXPOSE 8000
ENTRYPOINT ["../docker/server/entrypoint-prod.sh"]
CMD ["start"]