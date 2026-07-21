from django.urls import path

from .api.views import LocationListView

urlpatterns = [
    path('', LocationListView.as_view(), name='location-list'),
]
