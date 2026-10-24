from django.urls import path
from calls.views import CallDetailView, CallHistoryListView

app_name = 'calls'

urlpatterns = [
    path('history/', CallHistoryListView.as_view(), name='call_history'),
    path('<int:pk>/', CallDetailView.as_view(), name='call_detail'),
]
