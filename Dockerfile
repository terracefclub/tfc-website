# Use an official Python runtime based on Debian 10 "buster" as a parent image.
ARG mode

FROM python:3.9.1-slim-buster as base

ARG USERNAME=admin
ARG USER_UID=1000
ARG USER_GID=$USER_UID
ARG PORT=8000
ARG WORKDIR=/app

# Create the main user
RUN groupadd --GID $user_gid $USERNAME && \
    useradd --uid $USER_UID --gid $USER_GID -m $USERNAME
# Grant the main user "sudo" access
RUN apt update --yes && \
    apt-get update --yes && \
    apt-get install -y sudo && \
    echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME  

# Install system dependencies
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
    apt-get install --yes --quiet nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Python web server dependencies
COPY requirements.txt /
RUN pip install -r /requirements.txt

# Set environment variables!
# Force Python stdout and stderr streams to be unbuffered.
ENV PYTHONUNBUFFERED=1
ENV PORT=$PORT 

# Copy project files
RUN chown $USERNAME:$USERNAME $WORKDIR
COPY --chown=$USERNAME:$USERNAME . $WORKDIR

EXPOSE $PORT
USER $USERNAME
WORKDIR $WORKDIR

FROM base AS dev
ENV DJANGO_SETTINGS_MODULE=website.settings.dev

FROM base AS prod
ENV DJANGO_SETTINGS_MODULE=website.settings.production 
# CMD ["gunicorn", "website.wsgi:application"]

FROM ${mode} AS final
RUN "This is the ${mode} build"