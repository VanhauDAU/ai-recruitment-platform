from django.urls import path

from ..views import GeoAutocompleteView, GeoPlaceView, GeoWardView, LocationListView

urlpatterns = [
    path('', LocationListView.as_view(), name='location-list'),
    path('geo/autocomplete/', GeoAutocompleteView.as_view(), name='geo-autocomplete'),
    path('geo/place/', GeoPlaceView.as_view(), name='geo-place'),
    path('geo/wards/<slug:slug>/', GeoWardView.as_view(), name='geo-ward'),
]
