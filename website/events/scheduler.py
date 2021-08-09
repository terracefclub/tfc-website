"""
Background-scheduled function for updating events models daily from Google 
Calendar API. Flow authenticates service agent that retrieves all newly 
modified events on the specified calendar, creates new events or updates old 
ones with any new information.
"""

import logging
import datetime
import requests
from django.utils import timezone

import os
import re
import pytz
import json

from urllib.parse import urlparse
from operator import itemgetter
from itertools import groupby

# Google authentication workflow imports
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account

# Background task scheduling libraries
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django_apscheduler.jobstores import DjangoJobStore

# django helpers for files, datetimes, and filesystem mgmt
from django import settings
from django.core.files.base import ContentFile
from django.utils.dateparse import parse_datetime
from django.utils.timezone import get_current_timezone

# relevant models to scheduled task
from wagtail.core.models import Image
from .models import Event

logger = logging.getLogger(__name__)

BASE_DIR = settings.BASE_DIR
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
CALENDAR_ID = 'primary'
DEFAULT_LINKS = ['instagram', 'facebook', 'zoom']

def authenticate():
  """ 
  Pass service account credentials to authenticate an instance of a service 
  for the google calendar API 
  """
  credentials = service_account.Credentials.from_service_account_file(
    os.path.join(BASE_DIR, os.environ['GOOGLE_SERVICE_ACCT_FILE']), 
    scopes=SCOPES
  )
  return build('calendar', 'v3', credentials=credentials)

def new_or_modified_events(gcal):
  """ 
  Retrieves newly modified events from Google Calendar API with authenticated 
  service 'gcal' 
  """

  # Define parameters for listing events
  event_params = {
    'calendarId': CALENDAR_ID,
    'orderBy': 'updated',
    'singleEvents': True,

    # only retrieve events modified/created in the past 24 hours
    'updatedMin': (
      timezone.now() - datetime.timedelta(days=1)
    ).isoformat('T')
  }

  # simple pageToken workflow to aggregate events 
  # resources across paginated responses
  result = gcal.events().list(**event_params).execute()
  events = result.get('items', [])
  while token := result.get('nextPageToken', None):
    result = gcal.events().list(**event_params, pageToken=token).execute()
    events += result.get('items', [])
  
  return events

def add_events_to_db():
  """ 
  Function to be called periodically for syncing calendar changes 
  with the database model 
  """
  gcal = authenticate()
  events = new_or_modified_events(gcal)

  def convert_time(api_time):
    """ 
    Convert time and timezone provided by calendar API into the appropriate 
    and proper Terrace, east coast time which will be the basis for the website 
    """
    return \
      parse_datetime(api_time['dateTime'])\
        .replace(tzinfo=pytz.timezone(api_time['timeZone']))\
        .astimezone(tz=get_current_timezone())

  def parse_links(description, *, domains=DEFAULT_LINKS):
    """ 
    Extract links included in the google event description for different domains
    specified to be privileged by the UI 
    """
    regex = '(?P<url>(https://(?:www\.{0}\.com|us02web\.{0}\.us)/[^\s]*))'
    return [
      re.search(
        regex.format(domain).encode('unicode_escape'), description
      ).group('url') for domain in domains
    ]
  
  def clean_description(description, *, links=[]):
    """ 
    Quickly extract the remaining description with the parsed links removed. 
    Must be called after 'parse_links' 
    """
    for link in links:
      description = description.replace(link, '')
    return description

  def first_image_attachment(attachments):
    """ 
    Returns a wagtail Image instance representing the first image attached to 
    the google calendar event as a thumbnail/main detail image for the event. 
    Returns 'None' if there is no image and creates an instance if the image 
    'filename' is new (not in postgres).
    """
    for attachment in attachments:
      url = attachment['fileUrl']
      filename = urlparse(url).path.split('/')[-1]
      is_image = 'image' in attachment['mimeType']
      if is_image: 
        if not Image.objects.filter(file__icontains=filename).exists():
          response = requests.get(url)
          if response.status_code == 200:
            # successfully saved image that doesn't exist in postgres
            return Image.objects.create(filename, ContentFile(response.context))
          logger.error(f'[website/events]: File from "{url}" not saved!')
        else:
          # provide instead the existing instance
          return Image.objects.filter(file__icontains=filename).first()

    # it is still a nullable field on Event
    return None   

  def group_by_existing(events_):
    """ 
    Group events by whether there already exists an event with the same name, 
    start, and end time (TODO: change this to be for 'id', meaning the field 
    'id' will represent the unique event IDs provided by the calendar API) 
    """
    groups = { 'existing': [], 'new': [] }
    for event in events_:
      existing_filter = Event.objects.filter(
        name=events['summary'], 
        start=convert_time(event['start']), 
        end=convert_time(event['end']))
      if existing_filter.exists():

        # existing events are repackaged with their new event information
        groups['existing'].append({ 
          'existing': existing_filter.first(), 
          'event': event })
      else:
        groups['new'].append(event)
    return groups

  def model_dict(event_):
    """ 
    Callable for a dictionary representing any new changes specified in the 
    day's google calendar event modifications passed by the api 
    """
    return dict(
      name=event_['summary'],
      start=convert_time(event_['start']),
      end=convert_time(event_['end']),
      links=json.dumps(links := parse_links(event_['description'])),
      description=clean_description(event_['description'], links=links),
      image=first_image_attachment(event_['attachments'])
    )

  # group by whether updating or creating is necessary given google event info
  events = group_by_existing(events)

  Event.objects.bulk_create([
    Event(**model_dict(event)) for event in events['new']
  ])

  # bulk set uninstantiated events for a bulk_update call
  for event in events['existing']:
    fields = model_dict(event['event'])
    for field, val in fields.items():
      event['existing'][field] = val
  Event.objects.bulk_update(events['existing'], fields.keys())      

  


def start():
  """ 
  Scheduling function called in events.apps.EventConfig when the app is prepared
  on server load. Initiates a cron job triggered background scheduler and error 
  handling during scheduler runs 
  """
  scheduler = BackgroundScheduler()
  scheduler.add_jobstore(DjangoJobStore(), 'default')
  scheduler.add_job(
    add_events_to_db,
    trigger=CronTrigger(hour=9),
    jobstore='default',
    id='add_events_to_db',
    max_instances=1,
    replace_existing=True)
  logger.info("[server/events]: Added daily job: 'add_events_to_db'")

  try:
    logger.info('[server/events]: Starting scheduler...')
    scheduler.start()
  except KeyboardInterrupt:
    logger.info('[server/events]: Stopping scheduler...')
    scheduler.shutdown(wait=False)
    logger.info('[server/events]: Scheduler shut down succesfully!')