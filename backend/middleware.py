from typing import Callable
from django.http.request import HttpRequest
from django.http.response import (
    HttpResponse,
    HttpResponseForbidden,
    HttpResponseNotAllowed,
)
from django.template.loader import render_to_string


class RenderErrorsAs404Middleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response
        self.error_responses = (HttpResponseNotAllowed, HttpResponseForbidden)

    def __call__(self, request: HttpRequest):
        response = self.get_response(request)
        if isinstance(response, self.error_responses):
            response.content = render_to_string("404.html", request=request)
        return response
