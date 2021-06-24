# TFC Website

TFC Website Revamp Project

https://docs.google.com/document/d/12Hb0rczOJEcjdv2pzkIkSqdRnas9zvIRU98MMf7aNEw
https://drive.google.com/file/d/12EHvHrF0ASJr5fxwi042bEIhLPCaYy9v/view?usp=sharing

# Building

```
pip install --upgrade build
python -m build
```

PyPI??? (needs API token!)
```
pip install twine
twine upload --repository testpypi dist/*
# username = __token__
# password = <THE TOKEN>
```

# Testing

```
# py.test test.py --cov=sample.py [--cov-report]
coverage run --source=sample -m pytest test.py
coverage report -m
```

# Initiate CI

```
docker run --rm -v $PWD:$PWD -v /var/run/docker.sock:/var/run/docker.sock -v gitlab-runner-config:/etc/gitlab-runner --workdir $PWD --name gitlab-runner -e RUNNER_PRE_BUILD_SCRIPT="export $(cat .env | tr '\n' ' ')" gitlab/gitlab-runner:latest exec docker --docker-privileged build
```