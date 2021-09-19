from typing import List
from django.forms.formsets import formset_factory
from django.forms.models import modelform_factory
from .models import FoodItem, Menu
from .menu_parser import MenuData


def generate_upload_confirmation_form(data: List[MenuData]):
    MenuForm = modelform_factory(Menu, fields=("date", "theme"))
    FoodItemForm = modelform_factory(
        FoodItem, fields=("name", "tags", "course")
    )

    forms = [
        {
            "menu_form": MenuForm(
                initial={
                    field: getattr(menu_data, field)
                    for field in MenuForm.fields
                }
            ),
            "dishes_formset": formset_factory(FoodItemForm)(
                initial=menu_data.dishes
            ),
        }
        for menu_data in data
    ]
    return forms
