#!/bin/bash

zsh_setup() {
  sudo apk add zsh 

  echo "auth sufficient pam_rootok.so" > chsh
  sudo mv chsh /etc/pam.d/chsh
  sudo chsh -s /bin/zsh $(whoami)

  zsh
  
  # Install oh-my-zsh
  omz_url=https://github.com/robbyrussell/oh-my-zsh/raw/master/tools/install.sh
  curl -fsSL $omz_url | zsh -;
}

gcloud_setup() {
  SDK_ZIP="https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-355.0.0-linux-x86_64.tar.gz"

  wget $SDK_ZIP -O /tmp/google-cloud-sdk.tar.gz
  sudo mkdir -p /usr/local/gcloud
  sudo tar -C /usr/local/gcloud -xzf /tmp/google-cloud-sdk.tar.gz
  sudo /usr/local/gcloud/google-cloud-sdk/install.sh
}

terraform_setup() {
  sudo apk add terraform
}

if [[ $# -eq 0 ]]; then
  zsh_setup
  gcloud_setup
  terraform_setup
  exit 1
else
  "$@"
fi

