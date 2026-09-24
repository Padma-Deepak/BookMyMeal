from pathlib import Path

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, HttpResponse
from django.urls import include, path, re_path


def serve_react(request):
    """Catch-all that serves the React SPA for any non-API, non-admin route."""
    index = Path(settings.FRONTEND_DIST) / 'index.html'
    if index.exists():
        return FileResponse(open(index, 'rb'), content_type='text/html')
    return HttpResponse(
        '<p>Frontend not built. Run: <code>cd frontend && npm run build</code></p>',
        status=503,
    )


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    re_path(r'^(?!api/|admin/|media/|static/).*$', serve_react),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
