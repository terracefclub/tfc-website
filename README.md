# TFC Website

TFC Website Revamp Project

https://docs.google.com/document/d/12Hb0rczOJEcjdv2pzkIkSqdRnas9zvIRU98MMf7aNEw
https://drive.google.com/file/d/12EHvHrF0ASJr5fxwi042bEIhLPCaYy9v/view?usp=sharing

# Develop locally
```
./scripts/develop.sh
./scripts/gitlab-ci-test.sh
```

# Locally test CI build
Unfortunately, other steps in the CI pipeline are not supported for testing yet on an independent runner. Not sure how to go about testing without clogging up git and pipelines.

```
docker run --rm -v $PWD:$PWD -v /var/run/docker.sock:/var/run/docker.sock -v gitlab-runner-config:/etc/gitlab-runner --workdir $PWD --name gitlab-runner -e RUNNER_PRE_BUILD_SCRIPT="export $(cat .env | tr '\n' ' ')" gitlab/gitlab-runner:latest exec docker --docker-privileged build
```

# Upload any remote data
```
pg_dump -Fp --no-acl --no-owner -h localhost -U user web > latest.dump
# for example:
```

# Restore local database
```
pg_restore --verbose --clean --no-acl --no-owner -h localhost -U user -d web <latest.dump>
```