#!/bin/zsh

source config/env/local-ci.env

wsl_build() {
  UUID=$(id -un) GUID=$(id -gn) BASEDIR=/usr/src/womb PIPARGS="" \
    GOOGLE_CREDENTIALS=$(cat config/credentials.json | base64 -w 0) \
    WSLENV=$WSLENV::UUID::GUID::BASEDIR::PIPARGS:GOOGLE_CREDENTIALS \
    devcontainer open .
}

build() {
  UUID=$(id -un) GUID=$(id -gn) BASEDIR=/usr/src/womb PIPARGS="" \
    GOOGLE_CREDENTIALS=$(cat config/credentials.json | base64 -w 0) \
    devcontainer open .
}

"$@"