"""
Models for public-facing Wagtail site that play a more generic role and are not
associated with a particular application that has specific functionality.
"""

import datetime
import json

from django.utils import timezone
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.shortcuts import render, redirect
from wagtail.admin.mail import send_mail

# MODELS
from wagtail.contrib.forms.models import (
  AbstractEmailForm, AbstractFormSubmission
)
from wagtail.core.models import Page, PageManager, PageQuerySet
from ..blog.models import BlogPage
from ..menus.models import WeeklyMenuPage

# FIELDS
from django.db.models import (
  ForeignKey, IntegerField, BooleanField,
  CASCADE, SET_NULL
)
from modelcluster.fields import ParentalKey
from wagtail.contrib.forms.models import AbstractFormField
from wagtail.core.fields import RichTextField, StreamField
from wagtail.search.index import SearchField

# PANELS
from wagtail.admin.edit_handlers import (
  FieldPanel, MultiFieldPanel, StreamFieldPanel, FieldRowPanel
)
from wagtail.contrib.forms.edit_handlers import FormSubmissionsPanel
from .edit_handlers import InlinePanel

# BLOCKS
from wagtail.core.blocks import (
  StreamBlock, PageChooserBlock, RawHTMLBlock, RichTextBlock
)
from .blocks import BodyStreamBlock

def get_all_page_types():
  """
  Django ORM equivalent of the following RawSQL Query:
  
  SELECT CONCAT(app_label, '.', model) AS page_types 
    FROM django_content_type WHERE id IN (
          SELECT DISTINCT content_type_id 
          FROM wagtailcore_page
  )
  """
  from django.contrib.contenttypes.models import ContentType
  from django.db.models import F

  contenttype_values = ContentType.objects\
    .filter(pages__content_type_id=F('id'))\
    .distinct('id')\
    .values('app_label', 'model')
  return ['.'.join([ct['app_label'], ct['model']]) for ct in contenttype_values]

class HomePage(Page):
  """
  Main landing page for the public-facing site.

  :var pinned_posts: BlogPage instances to pin on the front page
  :var body: freeform sections to populate with any kind of content
  """
  pinned_posts = StreamField(
    StreamBlock([
      ('page', PageChooserBlock(page_type=BlogPage))
    ], template='blocks/carousel.html', required=False),
    blank=True, null=True)
  body = StreamField(BodyStreamBlock(), verbose_name="Home Body", blank=True)

  parent_page_types = [Page]
  exclude_subpage_types = ['blog.blogpage', 'menus.weeklymenupage']

  # this cannot be dynamic because the models need to be loaded before querying
  """
  subpage_types = [
    page for page in get_all_page_types() if page not in exclude_subpage_types
  ]
  """

  content_panels = Page.content_panels + [
    StreamFieldPanel('pinned_posts', heading='Pinned Posts'),
    StreamFieldPanel('body', heading="Additional Content"),
  ]

  def get_current_menupage(self):
    """
    Retrieves the current (time of access) dinner menu for display
    """
    return WeeklyMenuPage.objects\
      .filter(starting_day__lte=timezone.now().date())\
      .order_by('starting_day')\
      .last()


class SimplePage(Page):
  """
  Basic page for creating simple announcements.
  
  :var body: freeform sections supporting rich text editing and raw HTML
  """
  body = StreamField([
    ('html', RawHTMLBlock()),
    ('text', RichTextBlock())
  ])

  parent_page_types = [HomePage]
  subpage_types = []

  content_panels = Page.content_panels + [
    StreamFieldPanel('body', classname="full")
  ]

  # these pages can have their `body` searched for partial matches
  search_fields = [
    SearchField('body', partial_match=True)
  ]

class FormField(AbstractFormField):
  """
  AbstractEmailForm expects 'form_fields' to be defined.
  This reverse relationship allows accessing all of the fields
  that were included in the form.

  :var page: the :model:`website.base.FormPage` instance containing this FormField
  """
  page = ParentalKey('base.FormPage',
    on_delete=CASCADE, related_name='form_fields')

class FormPageQuerySet(PageQuerySet):
  """ Adds new query methods to :model:`website.base.FormPage` """
  def private(self):
    """ Filters for FormPages used on the private Flabyrinth site """
    return self.filter(is_private=True)
  
  def public(self):
    """ Filters for FormPages used on the public-facing Wagtail site """
    return self.filter(is_private=False)

FormPageManager = PageManager.from_queryset(FormPageQuerySet)

class FormPage(AbstractEmailForm):
  """
  Page encapsulating general-purpose, extendable form logic.
  Includes email support! => ``to_address``, ``from_address`` and ``subject``
  are already defined for email handling.

  :var max_submissions_per_user: how many times a user can submit the form
  :var thank_you_text: Text to be displayed on form submission
  :var thank_you_page: Page to be redirected too on form submission
  """
  is_private = BooleanField(default=False)
  max_submissions_per_user = IntegerField(default=-1)
  thank_you_text = RichTextField(blank=True)
  thank_you_page = ForeignKey(
    'wagtailcore.Page',
    null=True, blank=True,
    on_delete=SET_NULL,
    related_name='+'
  )

  parent_page_types = [HomePage]

  # model manager supporting new FormPageQuerySet methods
  objects = FormPageManager()

  content_panels = AbstractEmailForm.content_panels + [

    # adds read-only metadata on submissions on admin edit page
    FormSubmissionsPanel(),
    InlinePanel('form_fields', label='Form Fields'),
    FieldPanel('thank_you_text', classname='full'),
    MultiFieldPanel([
      FieldRowPanel([
        FieldPanel('from_address', classname='col6'),
        FieldPanel('to_address',  classname='col6')
      ]),
      FieldPanel('subject')
    ], heading='Email Information')
  ]

  def serve(self, request, *args, **kwargs):
    """
    Overridden to serve the form `self.max_submissions_per_user` number of times
    per unique user. A default value of -1 indicates no limit on users.
    """
    if self.is_private:
      if self.max_submissions_per_user > 0 and\
        self.get_submission_class().objects.filter(
          page=self, user=request.user
        ).count() >= self.max_submissions_per_user:
        return render(
          request,
          self.get_template(request),
          self.get_context(request)
        )
    return super().serve(request, *args, **kwargs)

  def send_mail(self, form):
    """ 
    Extend general email sending logic to include a list of addresses and a
    datestamped subject 
    """
    addresses = [addr.strip() for addr in self.to_address.split(',')]
    subject = f'{self.subject} - {datetime.date.today().strftime("%x")}'
    send_mail(subject, self.render_email(form), addresses, self.from_address)


  def render_landing_page(self, request, form_submission=None, *args, **kwargs):
    """ Change what page is rendered on FormPage submission """
    if self.thank_you_page:

      # preview the submission instance on the landing page if exists
      url = self.thank_you_page.url
      if form_submission:
        url += f'?id={form_submission.id}'
      
      return redirect(url, permanent=False)
    return super().render_landing_page(request, form_submission, *args, **kwargs)
  
  def render_email(self, form):
    """ Add new fields to the rendered email confirmation """
    content = super().render_email(form)
    
    title = f'Form: {self.title}'
    via = f'Submitted via: {self.full_url}'
    date = f'Submitted on: {datetime.date.today().strftime("%x")}'
    user = f'Submitted by: {form.user.username}'

    return '\n'.join([title, '', content, '', via, date, user])

  def get_data_fields(self):
    """ Add extra data labels to CSV form export (user Username) """
    data_fields = super().get_data_fields()
    if self.is_private:
      data_fields = [('username', 'Username')] + data_fields
    return data_fields

  def get_form_fields(self):
    """ Includes all FormFields in the form """
    return self.form_fields.all()

  def get_submission_class(self):
    """ Connects to :model:`website.base.FormPageSubmission` """
    return FormPageSubmission

  def process_form_submission(self, form):
    """ Create new submission with extra form data """
    self.get_submission_class().objects.create(
      form_data=json.dumps(form.cleaned_data, cls=DjangoJSONEncoder),
      page=self,
      user=form.user
    )

class FormPageSubmission(AbstractFormSubmission):
  """ 
  Customized form submission for :model:`website.base.FormPage` for associating
  extra user data on private site submissions.
  """
  user = ForeignKey(settings.AUTH_USER_MODEL, on_delete=CASCADE, null=True, blank=True)
    
  def get_data(self):
    """ Adds user data to form submission data when appropriate """
    form_data = super().get_data()
    if self.user:
      form_data['username'] = self.user.username
    return form_data
