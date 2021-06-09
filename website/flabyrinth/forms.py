from django.forms import (
  CharField, TextInput, IntegerField, Textarea, 
  FileField, BooleanField, NumberInput
)
from allauth.account.forms import SignupForm
from django.utils.translation import gettext_lazy as _
from address.forms import AddressField
from django.utils.timezone import now
from taggit.forms import TagField
from taggit_autosuggest.widgets import TagAutoSuggest
from phonenumber_field.formfields import PhoneNumberField
from phonenumber_field.widgets import PhoneNumberInternationalFallbackWidget
from website.flabyrinth.models import Profile, MentorProfile, MenteeProfile
from website.flabyrinth.widgets import UserTinyMCE
from django.forms import modelform_factory

class RegistrationForm(SignupForm):
  """ Overridden signup form to include all the different profile fields """

  ### PROFILE + USER FIELDS ###
  first_name = CharField(
    label=_('First Name'),
    widget=TextInput(attrs={ 'placeholder': _('First Name')})
  )
  last_name = CharField(
    label=_('Last Name'),
    widget=TextInput(attrs={ 'placeholder': _('Last Name')})
  )
  bio = CharField(widget=UserTinyMCE(mce_attrs={ 
    'toolbar_sticky': False,    # toolbar is not sticky on the registration form
    'menubar': False,           # removes confusing menubar a la MSWord
  }))
  graduation_year = IntegerField(
    max_value=now().year + 10,
    min_value=now().year - 100,  
    label=_('Graduation Year'),
    widget=NumberInput(attrs={ 
      'placeholder': f'Graduation Year ({now().year - 100} - {now().year + 10})'
    })
  )
  address = AddressField()
  tags = TagField(widget=TagAutoSuggest(tagmodel='default', attrs={ 'placeholder': 'Enter list of tags to emphasize on your profile'}))
  phone = PhoneNumberField(widget=PhoneNumberInternationalFallbackWidget(attrs={ 'placeholder': 'Phone Number: e.g. 123-456-7890'}))

  ### MENTOR PROFILE FIELDS ###
  mentor = BooleanField(required=True, initial=False)
  summary = CharField(max_length=250, widget=Textarea(attrs={'placeholder': 'Provide a general summary of your professional life and potential capacity as a mentor.'}), label=_('Professional Summary'))
  cv = FileField()
  mentor_tags = TagField(widget=TagAutoSuggest(tagmodel='default', attrs={ 'placeholder': 'Tags that best represent your career focus and professional knowledge'}))

  ### MENTEE PROFILE FIELDS ###
  mentee = BooleanField(required=True, initial=False)
  looking_for_help = CharField(max_length=250, widget=Textarea(attrs={ 'placeholder': 'Describe what you are looking for mentors in. Mentors will be able to read these to help identify mentees they may be fit to help enter a new work industry or learn about running a business or prepare for more schooling. Mentorship could also less career driven too, centering instead around projects or even just life itself but still anchored by specific goals.'}), label=_('Professional Summary'))
  mentee_tags = TagField(widget=TagAutoSuggest(tagmodel='default', attrs={ 'placeholder': 'Tags that best represent your career interests and mentorship preferences'}))

  def save(self, request):
    """ Save all models in a row -- user, profile, mentor/mentee profiles """
    user = super(RegistrationForm, self).save(request)
    profile = modelform_factory(Profile)({**request.POST, 'user': user }).save()
    if self.cleaned_data.get('mentor'):
      modelform_factory(MentorProfile)({
        **request.POST, 'profile': profile, 
        'tags': self.cleaned_data.get('mentor_tags') 
      }, request.FILES).save()
    if self.cleaned_data.get('mentee'):
      modelform_factory(MenteeProfile)({
        **request.POST, 'profile': profile, 
        'tags': self.cleaned_data.get('mentee_tags') 
      }).save()
    return user
