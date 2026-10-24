from django.urls import include, path
from commute.views import health_check

app_name = 'api'

urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('auth/', include('users.urls')),
    path('users/', include('users.api_urls')),
    path('calls/', include('calls.urls')),
    path('', include('chat.urls')),
]
