from typing import Optional
from django.http.request import HttpRequest
from django.http.response import (
    HttpResponse,
    HttpResponseNotAllowed,
    HttpResponseRedirect,
)
from django.shortcuts import render
from django.http import HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from datetime import datetime, date

from taggit.models import Tag
from wagtail.documents.models import Document
from menus.models import (
    FoodCourse,
    FoodTag,
    MenuIndexPage,
    MenuTheme,
    WeeklyMenuPage,
    Menu,
    MenuFoodItem,
    FoodItem,
)
from django.forms.models import (
    inlineformset_factory,
    modelform_factory,
    modelformset_factory,
)
from menus.menu_parser import Dish, parse_data_from_menu_document


menu_fields = ("date", "theme")
menufooditem_fields = ("food_item",)
fooditem_fields = ("name", "description", "tags", "course")
menupage_fields = ("starting_day",)

MenuPageModelForm = modelform_factory(WeeklyMenuPage, fields=menupage_fields)
MenuFormSet = inlineformset_factory(WeeklyMenuPage, Menu, fields=menu_fields)
MenuFoodItemFormSet = inlineformset_factory(
    Menu, MenuFoodItem, fields=menufooditem_fields
)
FoodItemFormSet = modelformset_factory(FoodItem, fields=fooditem_fields)


def get_fooditem(dish: Dish) -> Optional[int]:
    try:
        pk = FoodItem.objects.get(name=dish.name).pk
    except FoodItem.DoesNotExist:
        return None
    return pk


@require_http_methods(["POST"])
def handle_menu_upload(request: HttpRequest, monday: date) -> HttpResponse:
    """
    Accept an incoming .docx file upload on the MenuPage creation menu.
    Parse the menu for data and add everything to the database.
    Returns an HttpResponseBadRequest if the file is not appropriate.

    :returns:
    """

    if WeeklyMenuPage.objects.filter(starting_day=monday).first() is not None:
        return HttpResponseNotAllowed(
            "There already exists a weekly menu for the specified date: "
            f"{monday}"
        )

    menu = request.FILES["menu"]

    # actually parse the document data
    data = parse_data_from_menu_document(menu, date=monday)

    # get base parent MenuIndexPage
    root = MenuIndexPage.objects.first()

    # save uploaded menu to a Document
    doc = Document.objects.create(title=menu.name, file=menu)

    # create new menu page for the week under the parent 'root'
    week = WeeklyMenuPage(
        title=f'Dinner Menu Week of {monday.strftime("%b %d, %Y")}',
        slug=f'menu-{monday.strftime("%Y-%m-%d")}',
        show_in_menus=True,
        starting_day=monday,
        doc=doc,
    )
    root.add_child(instance=week)
    root.save()

    for day in data:

        # get or create theme for the day (None if none parsed)
        theme = (
            MenuTheme.objects.get_or_create(theme=day.theme)[0]
            if day.theme
            else None
        )

        # get existing fooditems or create new ones from name-course combo
        food_items = [
            FoodItem.objects.get_or_create(
                name=dish.name,
                course=FoodCourse.objects.filter(name=dish.course).first(),
            )[0]
            for dish in day.dishes
        ]

        # Create tags for each dish
        _ = [
            FoodTag.objects.get_or_create(
                tag=Tag.objects.get_or_create(name=tag)[0],
                content_object=item,
            )[0]
            for dish, item in zip(day.dishes, food_items)
            for tag in dish.tags
        ]

        # initialize the menu with a date, theme, and assign it to the week
        menu = Menu.objects.get_or_create(
            date=day.date, theme=theme, week=week
        )[0]

        # associate dishes with the menu
        _ = [
            MenuFoodItem.objects.get_or_create(menu=menu, food_item=item)[0]
            for item in food_items
        ]

    return HttpResponseRedirect(f"/admin/pages/{week.id}/edit/")


@require_http_methods(["GET"])
def get_other_menus(request: HttpRequest) -> HttpResponse:
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
