import re
from typing import Union
from django.http.request import HttpRequest
from django.http.response import (
    JsonResponse,
)
from django.shortcuts import render
from django.http import HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime
from menus.models import WeeklyMenuPage
from .menu_parser import parse_data_from_menu_document
from storagers import temp_storage


@csrf_exempt
@require_http_methods(["POST"])
def handle_menu_upload(
    request: HttpRequest,
) -> Union[JsonResponse, HttpResponseBadRequest]:
    """
    Accept an incoming .docx file upload on the MenuPage creation menu.
    Parse the menu for menu data and return this as JSON for user to confirm.
    Returns an HttpResponseBadRequest if the file is not appropriate.

    :returns:
    """

    # confirm that a file was uploaded
    if not (menu := request.FILES["menu"]):
        return HttpResponseBadRequest("No menu provided.")

    # confirm proper naming scheme
    parser = re.compile(r"^menu_(?P<DATE>\d{2}-\d{2}-\d{4})\.(?P<EXT>\w+)$")
    if not (match := parser.match(menu.name)):
        return HttpResponseBadRequest(
            f'File "{menu.name}" does not have the correct name format for '
            'parsing: "menu_MM-DD-YYYY.docx". Remember to pad single-digit '
            "dates with a leading zero, as in 09-01-2021."
        )

    # confirm that file is in the MS word .docx format
    date_, extension = match.groups()
    if extension != "docx":
        return HttpResponseBadRequest(
            f"Uploaded file extension {extension} is not accepted .docx format."
        )

    # confirm name of file uses a Monday date
    # NOTE: this was included to enforce more consistency in Steve's file
    # naming conventions. this is accompanied by stricter menu templating too
    if (monday := datetime.strptime(date_, "%m-%d-%Y").date()).weekday() != 0:
        return HttpResponseBadRequest(
            f"Date {monday.strftime('%m-%d-%Y')} in the uploaded file name "
            "is not a Monday. Please rename the file to the week's Monday."
        )

    # save a temporary file in anticipation of follow-up response (confirmation)
    if temp_storage.exists(menu.name):
        temp_storage.delete(menu.name)
    temp_storage.save(menu.name, menu)

    # actually parse the document data
    menu_data = parse_data_from_menu_document(menu, date=monday)

    return JsonResponse({"menus": menu_data, "monday": monday})


def get_other_menus(request: HttpRequest):
    """
    Get the neighboring menus or wherever the query parameter 'start_date'
    is currently positioned while seeking through other menus

    :returns: HttpResponseBadRequest if important query parameter is not given
    """
    start_date_form = request.GET.get("start_date")
    direction = request.GET.get("direction")
    if start_date_form is None or direction is None:
        return HttpResponseBadRequest(
            "Query parameters `start_date` and `direction` must be defined!"
        )

    # extract start_date into database format and get 'count' (default: 5)
    start_date = datetime.strptime(start_date_form, "%Y-%m-%d").date()
    count = int(request.GET.get("count", 5))

    if direction == "forward":
        menus = WeeklyMenuPage.objects.filter(
            starting_day__gt=start_date
        ).order_by("starting_day")
        if (remainder := count - menus.count()) > 0:
            # add menus from before if there aren't enough afterward to display
            older_menus_chronological = WeeklyMenuPage.objects.filter(
                starting_day__lte=start_date
            ).order_by("-starting_day")[:remainder:1]
            menus = menus[::-1] + older_menus_chronological
        else:
            menus = menus[:count:-1]

    elif direction == "backward":
        menus = WeeklyMenuPage.objects.filter(
            starting_day__lt=start_date
        ).order_by("-starting_day")
        if (remainder := count - menus.count()) > 0:
            # add menus from after if there aren't enough from before to display
            newer_menus_chronological = WeeklyMenuPage.objects.filter(
                starting_day__gte=start_date
            ).order_by("starting_day")[:remainder:-1]
            menus = newer_menus_chronological + menus[::1]
        else:
            menus = menus[:count:1]

    # like the logic in model definition, adds attributes for newest and oldest
    # menu to prevent request to this :view:`menus.get_other_menus` when
    # there are no more to display in one direction
    oldest = WeeklyMenuPage.objects.order_by("starting_day").first()
    newest = WeeklyMenuPage.objects.order_by("starting_day").last()

    if menus[-1] is oldest:
        menus[-1].oldest = True
    if menus[0] is newest:
        menus[0].newest = True

    return render(request, "menus/other_menus.html", {"menu_pages": menus})
