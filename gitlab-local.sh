#!/bin/bash
mapfile -t env_vars < <(grep -v "^$" < .env)

declare -a envs=()
for env_var in "${env_vars[@]}"
do
  envs+=(--env "$env_var")
done

declare -a jobs=("build")
for job in "${jobs[@]}"
do
  gitlab-runner exec docker "${envs[@]}" --docker-privileged "$job"
done