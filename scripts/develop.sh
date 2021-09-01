# COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 

wsl_build() {
  UUID=$(id -un) GUID=$(id -gn) BASEDIR=/usr/src/womb PIPARGS="" \
    WSLENV=$WSLENV::UUID::GUID::BASEDIR::PIPARGS \
    devcontainer open .
}

"$@"