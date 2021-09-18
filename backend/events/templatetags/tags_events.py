"""
Template tags for use in the events calendar components
"""

from datetime import timedelta
from django.template.defaulttags import register
from django.db.models import Q
from django.db.models.expressions import RawSQL
from math import ceil
from collections import Counter
import calendar


@register.filter(name="month")
def month_int_to_short_name(month):
    """Maps a month number (disconnected from datetime object) to 3-letters"""
    return [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
    ][int(month) - 1]


@register.filter(name="multis")
def get_multiple_days(queryset):
    """Filters out all events that start and end on same day"""
    # NOTE: you can't do deep attribute access in F expressions with a
    # DateTimeField such as with the following:
    # queryset.filter(~Q(start__day=F('end__day')))
    # This generates the following invalid SQL:

    query = queryset.filter(
        ~Q(
            start__day=RawSQL(
                """
                EXTRACT('day' FROM "events_event"."end" AT TIME ZONE 'UTC')
                """,
                [],
            )
        )
    )

    return query


@register.filter
def week_of_month(date_time):
    """Calculates the index of the week a day is on in a month (UI calcs)"""
    first_day = date_time.replace(day=1)
    new_day_of_month = date_time.day + (1 + first_day.weekday()) % 7
    return int(ceil(new_day_of_month / 7))


@register.filter
def with_date(events, date):
    """Filters events simultaneously by start and end date"""
    return events.filter(start__date=date, end__date=date)


@register.simple_tag(name="calendar")
def month_calendar(year, month):
    """Uses `calendar` package to iterate thru the monthly calendar (7 cols)"""
    year, month = int(year), int(month)
    cal = calendar.Calendar(firstweekday=6)
    return [
        date for week in cal.monthdatescalendar(year, month) for date in week
    ]


@register.filter(name="days_counter")
def multi_date_events_days_counter(events):
    """
    Creates a counter of multiple-day events over each day in calendar (UI)
    """
    days = []
    for event in events:

        start, end = event.start, event.end
        days += [
            (start + timedelta(days=i)).date()
            for i in range((end.date() - start.date()).days + 1)
        ]
    return Counter(days)
