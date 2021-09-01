#!/bin/bash

run_pipeline() {
  # Start an instance of gitlab runner
  docker run -d \
    --name gitlab-runner \
    --workdir "$PWD" \
    -v "$PWD":"$PWD" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v gitlab-runner-config:/etc/gitlab-runner \
    -e RUNNER_PRE_BUILD_SCRIPT="export $(cat .env | tr '\n' ' ')" \
    gitlab/gitlab-runner:latest

  # Register local (docker) gitlab runner
  docker exec gitlab-runner register <<< $'...\n...'

  # Create array of environment variables
  mapfile -t env_vars < <(grep -v "^$" < .env)
  envs=()
  for env_var in "${env_vars[@]}"
  do
    envs+=(--env "$env_var")
  done
  

  # Extract job names from script arguments or just run "build"
  all_args=("$@")
  if [ ${#all_args[@]} -eq 1 ]; then
    jobs=("build")
  else
    jobs=all_args
  fi

  # Run each runner build separately in the registered runner container
  for job in "${jobs[@]}"
  do
    docker exec gitlab-runner exec docker "${envs[@]}" --docker-privileged "$job"
  done
}

IMAGE_GITLAB="$CI_REGISTRY/terrace/tech/tfc-website/web_app_server:prod"


test_build() {
  COMPOSE_DOCKER_CLI_BUILD=1 
  DOCKER_BUILDKIT=1 

  docker build "$@" --pull -t "$IMAGE_GITLAB" \
    -f docker/server/prod.Dockerfile .
}

test_push() {
  # Login into docker registry
  echo "$CI_WRITE_TOKEN" | docker login "$CI_REGISTRY" --username "$CI_WRITE_USER" --password-stdin

  # Push docker images to gitlab registry
  docker push "$IMAGE_GITLAB"
  docker push "$IMAGE_GITLAB-test"
}

test_run() {
  GOOGLE_CREDENTIALS=$(cat config/credentials.json | base64)
  LOCAL_CACHE=1
  args=()

  docker stop test_prod && docker rm test_prod

  if [ "$LOCAL_CACHE" ]; then 
    args+=("--env LOCAL_CACHE=1" "--network test_net")
    echo "Args = ${args[@]}"
    echo "Creating test network."
    docker network inspect test_net &> /dev/null || \
      docker network create --driver bridge test_net

    echo "Running local redis instance"
    docker run -d --name redis -p 6379 --network test_net redis &> /dev/null || true
  fi

  docker run -it -p 8000:8000 ${args[@]} \
    --env GOOGLE_CREDENTIALS="$GOOGLE_CREDENTIALS" \
    --name test_prod \
    --env-file config/env/.env \
    --env-file config/env/postgres.env \
    "$IMAGE_GITLAB" "$@"
}

"$@"
