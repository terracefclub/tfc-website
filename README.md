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