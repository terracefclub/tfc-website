ARG username=forkman
ARG BASEDIR=/usr/src/womb
ARG groupname=chillers

FROM node AS frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build



FROM python:3.9-alpine AS base
ARG apknocache=""
ARG pipargs=""
ARG STAGE
ARG BASEDIR
ARG username
ARG groupname

WORKDIR $BASEDIR
SHELL ["/bin/ash", "-eux", "-o", "pipefail", "-c"]
RUN \
    # Install system build dependencies into virtual folder
    apk add $apknocache --virtual .build-deps \
      linux-headers gcc libc-dev musl-dev \
      postgresql-dev python3-dev jpeg-dev \
      zlib-dev libffi-dev; \
    # Install system runtime dependencies
    apk add $apknocache \
      postgresql-libs \
      libjpeg geos gdal;
COPY backend/requirements backend/requirements
RUN \
    # Install python dependencies
    pip install --upgrade pip; \
    pip install $pipargs --no-deps \
      -r backend/requirements/$STAGE.txt; \
    # Remove system build dependencies
    apk --purge del .build-deps;
RUN \
    # Create runtime user
    addgroup --system $groupname; \
    adduser --system --disabled-password $username; \
    adduser $username $groupname; \
    # Create extra directories
    mkdir -p $BASEDIR/logs/django $BASEDIR/config; \
    chown -R $username:$groupname $BASEDIR;

# Support impromptu migration for STUPID apps
# looking at you wagtail_nav_menus!!!!!
RUN chown -R $username:$groupname /usr/local/lib/python3.9/site-packages/wagtail_nav_menus/migrations

ENV BASEDIR=$BASEDIR \
    DJANGO_SETTINGS_MODULE=settings.$STAGE \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STAGE=$STAGE
EXPOSE 8000
ENTRYPOINT ["./docker/server/entrypoint.sh"]
CMD ["start"]



FROM base AS dev
ARG username
ARG BASEDIR
RUN apk add --update sudo git bash npm curl shadow; \
    echo $username ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$username; \
    chmod 0440 /etc/sudoers.d/$username;
COPY frontend/package*.json frontend/
RUN npm --prefix $BASEDIR/frontend install $BASEDIR/frontend
USER $username



FROM base AS post_dev
ARG username
ARG groupname
COPY --chown=$username:$groupname . .



FROM post_dev AS test
ARG username
USER $username



FROM post_dev AS prod
ARG username
ARG PROXY_BINARY="https://storage.googleapis.com/cloudsql-proxy/v1.21.0/cloud_sql_proxy.linux.amd64"
RUN \
    # Add Cloud SQL Auth Proxy tool for authenticated access to GCP postgres
    wget $PROXY_BINARY -O /usr/local/bin/cloud_sql_proxy; \
    chmod +x /usr/local/bin/cloud_sql_proxy; \
    # Remove unnecessary testing files
    rm -rf backend/tests frontend/tests
USER $username
