
from factory.base import Factory
from events.blocks import MediaBlock
from wagtail_factories.factories import CollectionMemberFactory, ImageFactory
from tests.factories import StreamBlockFactory
from wagtail.core.blocks.field_block import URLBlock
from factory.declarations import LazyAttribute, SubFactory
from factory.faker import Faker
from wagtail_factories.blocks import BlockFactory, ChooserBlockFactory, StreamFieldFactory
from events.models import Event, EventsPage

from factory import Sequence
from factory.fuzzy import FuzzyChoice
from factory.django import DjangoModelFactory, FileField
from wagtail_factories import PageFactory
from django.utils import timezone

from wagtailmedia.models import get_media_model
from datetime import timedelta
from io import BytesIO

class MediaField(FileField):
  DEFAULT_FILENAME = '.wav'

  def _make_data(self, params):
    # TODO: implement video/audio factory logic (check `wagtailmedia`)
    return BytesIO().getvalue()

class MediaFactory(CollectionMemberFactory):
  class Meta:
    model = get_media_model()
  title = Sequence(lambda n: f'Media File {n}')
  file = MediaField()
  type = 'audio'

class MediaBlockFactory(ChooserBlockFactory):
  class Meta:
    model = MediaBlock
  media = SubFactory(MediaFactory)

  @classmethod
  def _build(cls, model_class, media):
    return media

  @classmethod
  def _create(cls, model_class, media):
    return media

class EventURLFactory(BlockFactory):
  class Meta:
    model = URLBlock

  value = FuzzyChoice([
    'https://www.instagram.com/', 
    'https://www.facebook.com/', 
    'https://zoom.us/'
  ])

class EventFactory(DjangoModelFactory):
  class Meta:
    model = Event
  name = Sequence(lambda n: f'Event {n}')
  start = Faker('date_time', 
    end_datetime=timezone.now() + timedelta(days=14),
    tzinfo=timezone.get_current_timezone())
  end = LazyAttribute(lambda obj: obj.start + timedelta(hours=3))
  description = f'<p>{Faker("paragraph", nb_sentences=5)}</p>'
  links = StreamFieldFactory({
    'url': EventURLFactory
  })
  image = SubFactory(ImageFactory)
  featured_media = StreamFieldFactory({
    'media': MediaBlockFactory
  })

class EventChooserBlockFactory(ChooserBlockFactory):
  class Meta:
    model = Event
  event = SubFactory(EventFactory)

  @classmethod
  def _build(cls, model_class, event):
    return event

  @classmethod
  def _create(cls, model_class, event):
    return event

class EventsPageFactory(PageFactory):
  class Meta:
    model = EventsPage
  past_highlights = StreamFieldFactory({
    'event': EventChooserBlockFactory
  })

  # TODO: lazy selector for only choosing among events in the future?
  future_highlights = StreamFieldFactory({
    'event': EventChooserBlockFactory
  })