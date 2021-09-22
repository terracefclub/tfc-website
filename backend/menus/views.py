from typing import List, Optional, Type
from django.http.request import HttpRequest
from django.http.response import HttpResponse, HttpResponseServerError
from django.shortcuts import redirect, render
from django.http import HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime, date
from menus.models import WeeklyMenuPage, Menu, MenuFoodItem, FoodItem
from django.forms.models import (
    BaseInlineFormSet,
    inlineformset_factory,
    modelform_factory,
    modelformset_factory,
)
from menus.menu_parser import Dish, parse_data_from_menu_document
from storagers import temp_storage


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
def confirm_menu_creation(request: HttpRequest, monday: date) -> HttpResponse:
    """
    Validate all forms submitted in confirmation and then create everything!
    """

    menupage = WeeklyMenuPage(starting_day=monday)
    menupage_form = MenuPageModelForm(request.POST)

    if menupage_form.is_valid():
        menupage_created: WeeklyMenuPage = menupage_form.save(commit=False)

        fooditem_formset = FoodItemFormSet(request.POST, prefix="fooditems")
        if fooditem_formset.is_valid():
            fooditems_created: List[FoodItem] = fooditem_formset.save(
                commit=False
            )

        menu_formset = MenuFormSet(
            request.POST, instance=menupage_created, prefix="menus"
        )
        if menu_formset.is_valid():
            menus_created: List[Menu] = menu_formset.save(commit=False)

        if fooditems_created and menus_created:
            menufooditem_formsets: List[BaseInlineFormSet] = []
            for i, menu in enumerate(menus_created):
                # TODO: if the fooditem is new, assign the `fooditems_created`
                # instances created above to the correct one, replacing
                # the request.POST dependency (most likely)
                menufooditem_formsets.append(
                    MenuFoodItemFormSet(
                        request.POST, instance=menu, prefix=f"fooditems_{i}"
                    )
                )
            if all([formset.is_valid() for formset in menufooditem_formsets]):
                menupage_created.save()
                for fooditem in fooditems_created:
                    fooditem.save()
                for menu in menus_created:
                    menu.save()
                for formset in menufooditem_formsets:
                    formset.save()
                return redirect(menupage.get_full_url(request))
    return HttpResponseServerError("Forms not valid! What to do, smdh")


@csrf_exempt
@require_http_methods(["POST"])
def handle_menu_upload(request: HttpRequest, monday: date) -> HttpResponse:
    """
    Accept an incoming .docx file upload on the MenuPage creation menu.
    Parse the menu for menu data and return this as JSON for user to confirm.
    Returns an HttpResponseBadRequest if the file is not appropriate.

    :returns:
    """

    # TODO: put `extra`, `min_num`, `max_num` limits on formsets

    menu = request.FILES["menu"]
    # save a temporary file in anticipation of confirmation
    if temp_storage.exists(menu.name):
        temp_storage.delete(menu.name)
    temp_storage.save(menu.name, menu)

    # actually parse the document data
    data = parse_data_from_menu_document(menu, date=monday)

    menupage = WeeklyMenuPage(starting_day=monday)
    menupage_form = MenuPageModelForm(instance=menupage)

    menu_formset = MenuFormSet(prefix="menus", instance=menupage)
    for form, menu_data in zip(menu_formset.forms, data):
        form.initial = {
            field: getattr(menu_data, field) for field in menu_fields
        }

    # TODO: create autocomplete widgets for all of these formsets
    menufooditem_formsets = [
        MenuFoodItemFormSet(prefix=f"fooditems-{i}")
        for i, _ in enumerate(menu_formset.forms)
    ]

    new_fooditems = []
    for formset, menu_data in zip(menufooditem_formsets, data):
        for form, dish in zip(formset.forms, menu_data.dishes):
            if fooditem := get_fooditem(dish):
                form.initial = {"food_item": fooditem}
            else:
                new_fooditems.append(dish)

    fooditem_formset = FoodItemFormSet(prefix="fooditems")
    for form, fooditem_data in zip(fooditem_formset.forms, new_fooditems):
        form.initial = {
            field: getattr(fooditem_data, field) for field in fooditem_fields
        }

    return render(
        request,
        "menus/upload_confirmation.html",
        {
            "menupage_form": menupage_form,
            "menu_formset": menu_formset,
            "menufooditem_formsets": menufooditem_formsets,
            "fooditem_formset": fooditem_formset,
            "monday": monday,
        },
    )


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
