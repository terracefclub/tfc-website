from wagtail.core import hooks
from wagtail.admin.menu import (
    Menu,
    MenuItem,
    SubmenuMenuItem,
    SubMenuItemComponent,
)
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

events_menu = Menu(
    register_hook_name="register_events_menu_item",
    construct_hook_name="construct_events_menu",
)


class EventsMenuItem(SubmenuMenuItem):
    template = "events/menu_events_menu_item.html"

    def render_component(self, request):
        return SubMenuItemComponent(
            self.name,
            self.label,
            self.menu.render_component(request),
            icon_name=self.icon_name,
            classnames=self.classnames,
            footer_text="Events Calendar Action Items",
        )


@hooks.register("register_admin_menu_item")
def register_events_menu():
    return EventsMenuItem(
        _("Events"), events_menu, icon_name="date", order=5000
    )


@hooks.register("register_events_menu_item")
def register_add_event_menu_item():
    url = reverse(
        "wagtailsnippets:add",
        kwargs={"app_label": "events", "model_name": "event"},
    )
    return MenuItem(_("Add Event"), url, icon_name="plus-inverse", order=1)


@hooks.register("register_events_menu_item")
def register_event_index_item():
    url = reverse(
        "wagtailsnippets:list",
        kwargs={"app_label": "events", "model_name": "event"},
    )
    return MenuItem(_("All Events"), url, icon_name="list-ol", order=2)
