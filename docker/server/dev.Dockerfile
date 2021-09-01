
FROM python:slim
ARG username
ARG groupname
ARG WORKDIR
SHELL ["/bin/bash", "-eux", "-o", "pipefail", "-c"]
WORKDIR $WORKDIR

# create user with sudo access and complete rest of build as the user
RUN groupadd $groupname; \
    useradd -g $groupname -m $username; \
    apt-get update -y; \
    apt-get install -qy --no-install-recommends sudo; \
    echo $username ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$username; \
    chmod 0440 /etc/sudoers.d/$username;
USER $username



RUN \
    # Install main system binaries
    sudo apt-get install -qy --no-install-recommends \
      build-essential \
      gdal-bin \
      libpq-dev \
      python3-dev \
      zlib1g-dev \
      libwebp-dev \
      unzip \
      git \
      curl \
      zsh; \
    sudo rm -rf /var/lib/apt/lists/*; \
    # Install node/javascript
    curl -fsSL https://deb.nodesource.com/setup_14.x -o /tmp/node.sh; \
    sudo chmod +x /tmp/node.sh && sudo /tmp/node.sh && sudo rm /tmp/node.sh; \
    sudo apt-get install -qy --no-install-recommends nodejs; \
    # Install terraform
    curl https://releases.hashicorp.com/terraform/1.0.5/terraform_1.0.5_linux_amd64.zip -o terraform.zip; \
    unzip terraform.zip; \
    sudo mv terraform /usr/local/bin; \
    sudo chmod 0755 /usr/local/bin/terraform; \
    rm terraform.zip; \
    # Set default shell
    sudo chsh -s /bin/zsh $username

# JAVASCRIPT
COPY frontend/package*.json frontend
RUN npm --prefix ./frontend install

# PYTHON
COPY backend/requirements backend/requirements
RUN pip install -r backend/requirements/dev.txt

ENV WORKDIR=$WORKDIR \
    DJANGO_SETTINGS_MODULE=settings.dev
EXPOSE 8000 8888
