"""
Hooks to customize Wagtail admin interface
"""

from django.templatetags.static import static
from django.utils.html import format_html_join
from wagtail.core import hooks
from wagtail.admin.menu import MenuItem


@hooks.register("insert_global_admin_js")
def admin_js():
    """
    Add script tags for any new JS to put in Wagtail admin.
    NOTE: the current, unimplemented intention was to support field population
    when uploading the PDF document to the :model:`menus.WeeklyMenuPage`
    edit/create endpoints
    """
    js_files = ["js/admin.js", "js/default.js", "js/vendors.js"]
    return format_html_join(
        "\n",
        '<script src="{0}"></script>',
        ((static(filename),) for filename in js_files),
    )


@hooks.register("insert_global_admin_css")
def admin_css():
    css_files = ["css/admin.css"]
    return format_html_join(
        "\n",
        '<link rel="stylesheet" href="{0}">',
        ((static(filename),) for filename in css_files),
    )


@hooks.register("register_admin_menu_item")
def register_add_weeklymenupage_item():
    return MenuItem(
        "Add Menu",
        "#",
        icon_name="plus-inverse",
        order=1000,
        attrs={"data-modal": "menu-upload"},
    )
