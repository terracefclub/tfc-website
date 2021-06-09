from website.tests.factories import TagFactoryMixin
from django.contrib.auth.models import User
from factory.declarations import RelatedFactory, Sequence, SubFactory
from factory.faker import Faker
from ..models import Profile, MenteeProfile, MentorProfile, FlabyrinthPostPage

from django.db.models.signals import post_save
from factory.django import DjangoModelFactory, mute_signals, FileField

@mute_signals(post_save)
class MenteeProfileFactory(TagFactoryMixin):
  class Meta:
    model = MenteeProfile
  profile = SubFactory('website.flabyrinth.tests.factories.ProfileFactory', mentee=None)
  looking_for_help = Faker('paragraph', nb_sentences=5)

@mute_signals(post_save)
class MentorProfileFactory(TagFactoryMixin):
  class Meta:
    model = MentorProfile
  profile = SubFactory('website.flabyrinth.tests.factories.ProfileFactory', mentor=None)
  summary = Faker('paragraph', nb_sentences=5)
  cv = FileField()

@mute_signals(post_save)
class ProfileFactory(TagFactoryMixin):
  class Meta:
    model = Profile
  user = SubFactory('website.flabyrinth.tests.factories.UserFactory', profile=None)
  address = Faker('address')
  bio = '<p>' + Faker('text', max_nb_chars=50) + '</p>'
  graduation_year = Faker('year')
  phone = Faker('phone_number')

  mentor = RelatedFactory(MentorProfileFactory, factory_related_name='profile')
  mentee = RelatedFactory(MenteeProfileFactory, factory_related_name='profile')

@mute_signals(post_save)
class UserFactory(DjangoModelFactory):
  class Meta:
    model = User
  username = Sequence(lambda n: f'user_{n}')
  first_name = Faker('first_name')
  last_name = Faker('last_name')

  profile = RelatedFactory(ProfileFactory, factory_related_name='user')
  pages = RelatedFactory('website.flabyrinth.tests.factories.FlabyrinthPostPageFactory', factory_related_name='author', action=FlabyrinthPostPage.ACTION_CREATE)

class FlabyrinthPostPageFactory(DjangoModelFactory):
  class Meta:
    model = FlabyrinthPostPage
  author = SubFactory(UserFactory)
  content = '<p>' + Faker('text', max_nb_chars=50) + '</p>'