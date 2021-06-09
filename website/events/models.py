
### MODELS ###
from wagtail.search.index import Indexed
from wagtail.core.models import Orderable, Page
from wagtail.snippets.models import register_snippet

### FIELDS ###
from wagtail.search.index import SearchField, FilterField
from django.db.models import CharField, DateTimeField, ForeignKey, SET_NULL
from wagtail.core.fields import RichTextField, StreamField

### BLOCKS ###
from wagtail.core.blocks import URLBlock, StreamBlock
from wagtail.snippets.blocks import SnippetChooserBlock
from website.events.blocks import MediaBlock


### PANELS ###
from wagtail.admin.edit_handlers import (
  FieldPanel, FieldRowPanel, MultiFieldPanel, 
  RichTextFieldPanel, StreamFieldPanel
)
from wagtail.images.edit_handlers import ImageChooserPanel

import datetime


@register_snippet
class Event(Orderable, Indexed):
  """
  Snippet for registering new events. Searchable and orderable for displaying 
  on the main events page.

  :var name: actual title of the event
  :var start: datetime for the beginning of the event
  :var end: datetime for the end of the event
  :var description: one-paragraph advertisement for the event. 
    specific event information will be located in a different place 
    (Instagram, Facebook, email, etc.)
  :var links: any special links to include with the event
  :var image: a photo to be displayed on the event detail and possibly 
    in the calendar
  :var featured_media: any videos or audio to include with event detail

  # TODO: address zoom room passwords somewhere. maybe anything posted to a 
  # public-facing events calendar doesn't need a password?
  """

  name = CharField(max_length=50)
  start = DateTimeField(verbose_name='starting date and time of event')
  end = DateTimeField(verbose_name='ending date and time of event')
  description = RichTextField(verbose_name='Paragraph advertisement for event')
  links = StreamField(
    StreamBlock([('url', URLBlock())], required=False), 
    verbose_name="External Links", blank=True, null=True
  )
  image = ForeignKey('wagtailimages.Image', 
    on_delete=SET_NULL, null=True, blank=True, related_name='+')
  featured_media = StreamField([
    ('media', MediaBlock(icon='media')),
  ], blank=True, null=True)

  panels = [
    MultiFieldPanel([
      FieldPanel('name'),
      RichTextFieldPanel('description'),
      FieldRowPanel([
        FieldPanel('start'),
        FieldPanel('end')
      ], heading='Date Information'),
      ImageChooserPanel('image')
    ], heading='Primary Information'),
    StreamFieldPanel('featured_media', heading='Featured Media (audio, video)'),
    StreamFieldPanel('links', heading='External Links')
  ]

  search_fields = [
    SearchField('name', boost=2),
    SearchField('description', partial_match=True),
    FilterField('start'),
    FilterField('end'),
    SearchField('links')
  ]

  def __str__(self):
    return f'{self.name} ({self.start} - {self.end})'

class EventsPage(Page):
  """
  Page for browsing events with a calendar, event detail area with social links,
  a history highlights area, and a (TBD) event statistics(???) area.

  TODO: determine future of data-driven events dashboard and possibly shift 
  focus instead to just a large event highlights regions, split between past 
  and future

  :var past_highlights: Past events to showcase in events calendar
  :var future_highlights: Upcoming events to showcase on side of events calendar
  """
  past_highlights = StreamField(StreamBlock([
    ('event', SnippetChooserBlock('events.Event'))
  ]), verbose_name="Highlighted events from the archive")
  future_highlights = StreamField(StreamBlock([
    ('event', SnippetChooserBlock('events.Event'))
  ]), verbose_name="Highlighted events in the near future")

  content_panels = Page.content_panels + [
    StreamFieldPanel('past_highlights'),
    StreamFieldPanel('future_highlights')
  ]

  def get_context(self, request):
    """ 
    Sets the initial calendar form input values to current month and year.
    Passes these and the events they filter into context for view.
    """
    context = super(EventsPage, self).get_context(request)
    now = datetime.datetime.now()
    values = {
      f'start__{field}': getattr(now, field) for field in ['month', 'year']
    }
    context['events'] = Event.objects.filter(**values)
    return context
  