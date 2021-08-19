ARG BASE_DIR=/usr/src/womb
ARG FRONTEND_DIR=website/frontend
ARG FRONTEND_DIR_FULL=$BASE_DIR/$FRONTEND_DIR

FROM python:slim as base
ARG BASE_DIR
ARG FRONTEND_DIR
ARG FRONTEND_DIR_FULL
ARG PORT=8000
ARG GROUPNAME=chillers
ARG USERNAME=forkman
ARG FULL_USERNAME=$USERNAME:$GROUPNAME

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN set -eux; \
    # Create the main user
    groupadd $GROUPNAME; \
    useradd -g $GROUPNAME -m $USERNAME; \
    # Install system dependencies
    apt-get update -y; \
    apt-get install -qy --no-install-recommends \
      ca-certificates=20200601~deb10u2 \
      curl=7.64.0-4+deb10u2 \
      build-essential=12.6 \
      gdal-bin=2.4.0+dfsg-1+b1 \
      libpq-dev=11.12-0+deb10u1 \
      python3-dev=3.7.3-1 \
      zlib1g-dev=1:1.2.11.dfsg-1 \
      libwebp-dev=0.6.1-2+deb10u1 \
      git=1:2.20.1-2+deb10u3 \
      sudo=1.8.27-1+deb10u3; \
    # Grant sudo access to main user
    echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME; \
    chmod 0440 /etc/sudoers.d/$USERNAME; \
    # Install Nodejs
    curl -fsSL https://deb.nodesource.com/setup_14.x | bash -; \
    apt-get install -qy --no-install-recommends nodejs; \
    # Trim excess
    rm -rf /var/lib/apt/lists/*;

# Install python web server dependencies
WORKDIR $BASE_DIR
COPY --chown=$FULL_USERNAME requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip==21.1.1; \
    pip install --no-cache-dir -r requirements.txt

# Install frontend build dependencies
WORKDIR $FRONTEND_DIR_FULL
COPY --chown=$FULL_USERNAME $FRONTEND_DIR/package.json .
RUN npm --prefix $FRONTEND_DIR_FULL i; \
    npm prune; \
    npm dedupe;
WORKDIR $BASE_DIR

# Transfer project files
COPY --chown=$FULL_USERNAME . .

ENV PATH=$PATH:/home/$USERNAME/.local/bin \
    PORT=$PORT \
    BASE_DIR=$BASE_DIR \
    FULL_USERNAME=$FULL_USERNAME \
    PYTHONUNBUFFERED=1

USER $FULL_USERNAME
EXPOSE $PORT
RUN chmod +x entrypoint.sh
CMD ["./entrypoint.sh"]

FROM base AS development
ENV DJANGO_SETTINGS_MODULE=website.settings.dev \
    STAGE=development

FROM base AS frontend_build
ARG BASE_DIR
ARG FRONTEND_DIR_FULL
ENV DJANGO_SETTINGS_MODULE=website.settings.production
WORKDIR $FRONTEND_DIR_FULL
RUN npm --prefix $FRONTEND_DIR_FULL run build
WORKDIR $BASE_DIR

FROM frontend_build AS testing
ENV STAGE=testing

FROM frontend_build AS production
ENV STAGE=production
