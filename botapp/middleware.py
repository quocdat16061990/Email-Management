from django.conf import settings
from django.http import HttpRequest, HttpResponse


class CorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        origin = request.headers.get("Origin", "")
        allowed = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
        if origin in allowed:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        if request.method == "OPTIONS":
            return HttpResponse(status=200)
        return response
