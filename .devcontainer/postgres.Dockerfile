FROM postgres:13-buster as base

ARG GROUPNAME=chillers
ARG USERNAME=forkman
ARG FULL_USERNAME=$USERNAME:$GROUPNAME
ARG PORT=5432
ARG WORKDIR=/home/$USERNAME

WORKDIR $WORKDIR

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN set -eux; \
    # Create the main user
    groupadd $GROUPNAME; \
    useradd -g $GROUPNAME -m $USERNAME; \
    # Install system dependencies
    apt-get update -y; \
    apt-get install -qy --no-install-recommends \
      ca-certificates=20200601~deb10u2 \
      gosu=1.10-1+b23 \
      curl=7.64.0-4+deb10u2; \
    # Install heroku
    curl https://cli-assets.heroku.com/install-ubuntu.sh | bash; \
    # Trim excess
    rm -rf /var/lib/apt/lists/*; \
    # Test gosu
    gosu $FULL_USERNAME bash -c 'whoami && id';

ENV PORT=$PORT \
    FULL_USERNAME=$FULL_USERNAME

EXPOSE $PORT
