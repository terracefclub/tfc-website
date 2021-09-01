from django.shortcuts import render
from django.http import HttpResponseBadRequest
from datetime import datetime
from menus.models import WeeklyMenuPage

def get_other_menus(request):
  """
  Get the neighboring menus or wherever the query parameter 'start_date'
  is currently positioned while seeking through other menus

  :returns: HttpResponseBadRequest if an important query parameter is not given
  """
  start_date = request.GET.get('start_date')
  direction = request.GET.get('direction')
  if start_date is None or direction is None:
    return HttpResponseBadRequest(
      'Both query parameters `start_date` and `direction` must be defined!'
    )

  # extract start_date into database format and get 'count' (default: 5)
  start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
  count = request.GET.get('count', 5)

  if direction == 'forward':
    menus = WeeklyMenuPage.objects\
      .filter(starting_day__gt=start_date)\
      .order_by('starting_day')
    if menus.count() < count:
      # add menus from before if there aren't enough afterward to display
      menus = menus[::-1] + \
        WeeklyMenuPage.objects.filter(starting_day__lte=start_date)\
          .order_by('-starting_day')[:count - menus.count():1]
    else:
      menus = menus[:count:-1]

  elif direction == 'backward':
    menus = WeeklyMenuPage.objects\
      .filter(starting_day__lt=start_date)\
      .order_by('-starting_day')
    if menus.count() < count:
      # add menus from after if there aren't enough from before to display
      menus = WeeklyMenuPage.objects\
        .filter(starting_day__gte=start_date)\
        .order_by('starting_day')[:count - menus.count():-1] + menus[::1]
    else:
      menus = menus[:count:1]

  # like the logic in model definition, adds attributes for newest and oldest
  # menu to prevent request to this :view:`menus.get_other_menus` when
  # there are no more to display in one direction
  oldest = WeeklyMenuPage.objects.order_by('starting_day').first()
  newest = WeeklyMenuPage.objects.order_by('starting_day').last()

  if menus[-1] is oldest:
    menus[-1].oldest = True
  if menus[0] is newest:
    menus[0].newest = True

  return render(request, 'menus/other_menus.html', { 'menu_pages': menus })