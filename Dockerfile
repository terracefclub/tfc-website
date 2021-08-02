ARG BASE_DIR=/usr/src/womb
ARG FRONTEND_DIR=website/frontend
ARG FRONTEND_DIR_FULL=$BASE_DIR/$FRONTEND_DIR

FROM python:3.9.1-slim as base
ARG PORT=8000
ARG GROUPNAME=chillers
ARG USERNAME=forkman
ARG BASE_DIR
ARG FRONTEND_DIR
ARG FRONTEND_DIR_FULL
ENV PATH=$PATH:/home/$USERNAME/.local/bin
ENV PORT=$PORT 
EXPOSE $PORT

# Create the main user
RUN groupadd $GROUPNAME && \
    useradd -g $GROUPNAME -m $USERNAME
# Grant the main user "sudo" access
RUN apt-get update --yes && \
    apt-get install -y sudo && \
    echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME
USER $USERNAME

# Install system dependencies
# WORKDIR /tmp
# RUN sudo apt-get -qq install --yes --quiet --no-install-recommends \
#       build-essential \
#       gdal-bin \
#       libpq-dev \
#       python3-dev \
#       zlib1g-dev \
#       libwebp-dev \
#       git \
#       curl && \
#     sudo curl -fsSL https://deb.nodesource.com/setup_14.x | sudo bash - && \
#     sudo apt-get -qq install --yes --quiet nodejs

# Install web server dependencies
WORKDIR $BASE_DIR
COPY requirements.txt .
# RUN python -m pip install --upgrade pip && \
#     pip install -r requirements.txt

WORKDIR $FRONTEND_DIR_FULL
COPY $FRONTEND_DIR/package.json .
RUN sudo chown -R $USERNAME:$GROUPNAME .
#     npm --prefix $FRONTEND_DIR_FULL i

WORKDIR $BASE_DIR

# Copy project files
COPY --chown=$USERNAME:$GROUPNAME . .
RUN sudo chown -R $USERNAME:$GROUPNAME .



FROM base AS development
ENV DJANGO_SETTINGS_MODULE=website.settings.dev
CMD ["/bin/sh", "-c", "while sleep 1000; do :; done"]



FROM base AS frontend_build
ARG BASE_DIR
ARG FRONTEND_DIR_FULL
ENV DJANGO_SETTINGS_MODULE=website.settings.production
# WORKDIR $FRONTEND_DIR_FULL
# RUN npm --prefix $FRONTEND_DIR_FULL run build
WORKDIR $BASE_DIR



FROM frontend_build AS testing
RUN chmod +x entrypoint-test.sh
CMD ["./entrypoint-test.sh"]



FROM frontend_build AS production
ENV PYTHONUNBUFFERED=1
CMD ["./entrypoint-prod.sh"]