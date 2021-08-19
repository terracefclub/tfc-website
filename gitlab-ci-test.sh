#!/bin/bash

# Start an instance of gitlab runner
docker run -d \
  --name gitlab-runner \
  --workdir $PWD \
  -v $PWD:$PWD \
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
else; then
  jobs=all_args
fi

# Run each runner build separately in the registered runner container
for job in "${jobs[@]}"
do
  docker exec gitlab-runner exec docker "${envs[@]}" --docker-privileged "$job"
done