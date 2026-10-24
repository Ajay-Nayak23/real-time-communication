from django.urls import path
from users.views import UserDirectoryListView, UserProfileMeView

app_name = 'users'

urlpatterns = [
    path('', UserDirectoryListView.as_view(), name='user_directory'),
    path('me/', UserProfileMeView.as_view(), name='user_me'),
    path('profile/', UserProfileMeView.as_view(), name='user_profile'),
]
