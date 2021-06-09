import csv
import os
import re

from django.contrib.auth.validators import ASCIIUsernameValidator
from django.utils.deconstruct import deconstructible
from django.core.validators import (
  RegexValidator,  MaxLengthValidator,
  MinLengthValidator, ProhibitNullCharactersValidator
)

filename = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'slurs.csv')
with open(filename, 'r') as file:
  SLURS = [slur[0] for slur in csv.reader(file, delimiter='\n')]

@deconstructible
class SlurValidator(RegexValidator):
  """
  Used for validating usernames and content to prevent very offensive content
  """
  regex = "|".join(SLURS)
  inverse_match = True
  message = """
  Your username contains an ethnic slur. We don\'t condone this at Terrace F. 
  Club. Change your username."""
  flags = re.I

uname_validators = [
  MinLengthValidator(8),
  MaxLengthValidator(25),
  ProhibitNullCharactersValidator(),
  ASCIIUsernameValidator(),
  SlurValidator()
]