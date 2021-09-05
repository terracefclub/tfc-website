# COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 

wsl_build() {
  UUID=$(id -un) GUID=$(id -gn) BASEDIR=/usr/src/womb PIPARGS="" \
    GOOGLE_CREDENTIALS=$(cat config/credentials.json | base64) \
    WSLENV=$WSLENV::UUID::GUID::BASEDIR::PIPARGS:GOOGLE_CREDENTIALS \
    devcontainer open .
}

build() {
  UUID=$(id -un) GUID=$(id -gn) BASEDIR=/usr/src/womb PIPARGS="" \
    GOOGLE_CREDENTIALS=$(cat config/credentials.json | base64) \
    devcontainer open .
}

"$@"