from django.db.models import (
  FileField, CharField, OneToOneField, TextField, PositiveSmallIntegerField, 
  BooleanField, ForeignKey, DateTimeField, CASCADE, SET_NULL, SET_DEFAULT
)
from address.models import AddressField
from phonenumber_field.modelfields import PhoneNumberField
from website.flabyrinth.fields import FlabyrinthHTMLField

from django.db.models import Model
from django.contrib.auth.models import User
from taggit_autosuggest.managers import TaggableManager

from django.utils import timezone

def get_default_user():
  """ Treats the 'admin' (first superuser) as default user if unspecified """
  return User.objects.filter(username='admin', is_superuser=True).get()

class TimeMixin(Model):
  """
  Abstract model mixin for DateTimeFields that save when a model was created
  and when it was last updated.

  Note the departure from the canonical usage of `auto_now` and `auto_now_add`
  parameters in defining these fields. Using those, it would be much more
  difficult to ensure that the creation and update times were identical when
  first instantiating a model. Model.save has been overridden to do so.

  :var created_at: the datetime of when model instance is first created
  :var updated_at: the datetime of when model instance was last updated
  """
  created_at = DateTimeField(editable=False)
  updated_at = DateTimeField()

  def save(self, *args, **kwargs):
    now = timezone.now()
    if not self.id: # does not exist yet when first created
      self.created_at = now
    return super().save(*args, **kwargs)

  class Meta:
    abstract = True

class Profile(Model):
  """
  A profile automatically created when registering a user with flabyrinth.

  :var user: :model:`django.contrib.auth.User` instance
  :var address: the user's address if they want to share it
  :var bio: a richtext field for writing a bio about themselves
  :var graduation_year: the year a user did/will graduate
  :var tags: hashtags users can add to their profile (boosted search!)
  :var phone: the user's phone number for contact
  """
  user = OneToOneField(User, related_name='profile', on_delete=CASCADE)
  address = AddressField(related_name='+', blank=True, 
    null=True, on_delete=SET_NULL)
  bio = FlabyrinthHTMLField(blank=True, default='')
  graduation_year = PositiveSmallIntegerField(blank=True, null=True)
  tags = TaggableManager(blank=True)
  phone = PhoneNumberField(blank=True, null=True)

class MentorProfile(Model):
  """
  An additional profile, this time career centric, for a user to create and 
  participate in the mentorship program.

  :var profile: the :model:`website.flabyrinth.Profile` instance it's tied to
  :var summary: a basic text summary of someone's intentions as a mentor
  :var cv: a CV document for mentees to view and find an appropriate mentor
  :var tags: as described, another tagging system for industry/skills/knowledge
  """
  profile = OneToOneField(Profile, related_name='mentor', on_delete=CASCADE)
  summary = TextField(blank=True, null=True)
  cv = FileField(upload_to='mentorship', blank=True, null=True)
  tags = TaggableManager(blank=True, 
    verbose_name="Tags for labeling industry, skills, focus, knowledge, etc.")

class MenteeProfile(Model):
  """
  Another profile for mentees in the mentorship program.

  :var profile: the :model:`website.flabyrinth.Profile` instance it's tied to
  :var looking_for_help: a description of what the mentee needs support for
  :var tags: another tag system with (possibly) more mentee-friendly language
  """
  profile = OneToOneField(Profile, related_name='mentee', on_delete=CASCADE)
  looking_for_help = TextField(blank=True, null=True)
  tags = TaggableManager(blank=True, 
    verbose_name="Tags for labeling industry, skills, focus, knowledge, etc.")

class FlabyrinthPostPage(TimeMixin):
  """ 
  Any post on the private archive. Users instantiate this when sharing 
  multimedia to the community. 
  """
  author = ForeignKey(User, related_name='pages', 
    default=get_default_user, on_delete=SET_DEFAULT)
  content = FlabyrinthHTMLField(blank=True, default='')

