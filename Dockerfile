FROM python:3.9.1-slim as base

ARG GROUPNAME=chillers
ARG USERNAME=forkman
ARG PORT=8000
ARG BASE_DIR=/usr/src/womb
ARG FRONTEND_DIR=website/frontend

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

# Install system dependencies
WORKDIR /tmp
RUN apt-get install --yes --quiet --no-install-recommends \
      build-essential \
      gdal-bin \
      libpq-dev \
      python3-dev \
      zlib1g-dev \
      libwebp-dev \
      git \
      curl && \
    curl -fsSL https://deb.nodesource.com/setup_14.x | bash - && \
    apt-get install --yes --quiet nodejs

# Install web server dependencies
WORKDIR $BASE_DIR
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

WORKDIR $BASE_DIR/$FRONTEND_DIR
COPY $FRONTEND_DIR/package.json .
RUN npm i

WORKDIR $BASE_DIR

# Copy project files
COPY --chown=$USERNAME:$GROUPNAME . .
RUN sudo chown -R $USERNAME:$GROUPNAME .
USER $USERNAME



FROM base AS development
ENV DJANGO_SETTINGS_MODULE=website.settings.dev
CMD ["/bin/sh", "-c", "while sleep 1000; do :; done"]



FROM base AS testing
ENV DJANGO_SETTINGS_MODULE=website.settings.production
RUN cd $FRONTEND_DIR && npm run build



FROM base AS production
ENV DJANGO_SETTINGS_MODULE=website.settings.production
ENV PYTHONUNBUFFERED=1
RUN cd $FRONTEND_DIR && npm run build
RUN python manage.py collectstatic --noinput
CMD ["gunicorn", "website.wsgi:application"]