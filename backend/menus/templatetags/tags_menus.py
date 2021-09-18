from django.template.defaulttags import register


@register.filter
def dayofweek_symbol(date):
    """Template filter for a day of the week symbol"""
    to_symbol = {0: "M", 1: "T", 2: "W", 3: "R", 4: "F", 5: "S", 6: "U"}
    return to_symbol[date.weekday()]


@register.filter
def values(queryset, key):
    """Template filter for retrieving a queryset value_list"""
    if isinstance(queryset, dict):
        return queryset[key]
    return queryset.values_list(key, flat=True)
