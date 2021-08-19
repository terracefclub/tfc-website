# TFC Website

TFC Website Revamp Project

https://docs.google.com/document/d/12Hb0rczOJEcjdv2pzkIkSqdRnas9zvIRU98MMf7aNEw
https://drive.google.com/file/d/12EHvHrF0ASJr5fxwi042bEIhLPCaYy9v/view?usp=sharing

# Locally test CI build
Unfortunately, other steps in the CI pipeline are not supported for testing yet on an independent runner. Not sure how to go about testing without clogging up git and pipelines.

```
docker run --rm -v $PWD:$PWD -v /var/run/docker.sock:/var/run/docker.sock -v gitlab-runner-config:/etc/gitlab-runner --workdir $PWD --name gitlab-runner -e RUNNER_PRE_BUILD_SCRIPT="export $(cat .env | tr '\n' ' ')" gitlab/gitlab-runner:latest exec docker --docker-privileged build
```

# Upload local data
```
# in local postgres
PGUSER=user PGPASSWORD=password heroku pg:push DATABASE_URL -a tfc-website-staging-stable
```

# Upload any remote data
```
pg_dump -Fc --no-acl --no-owner -h localhost -U user web > mydb.dump
# for example:
aws s3 presign s3://<bucket>/<object>
heroku pg:backups:restore '<SIGNED URL>' DATABASE_URL
```

# Download backup
```
heroku pg:backups:capture -a tfc-website-staging-stable
heroku pg:backups:download -a tfc-website-staging-stable
```

# Restore local database
```
pg_restore --verbose --clean --no-acl --no-owner -h localhost -U user -d web <latest.dump>
```