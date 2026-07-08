from django.urls import path

from .views import CreateEmployerProfileView, IndustryListView, MyEmployerProfileView

urlpatterns = [
    path('profile/', MyEmployerProfileView.as_view(), name='employer-profile'),
    path('profile/create/', CreateEmployerProfileView.as_view(), name='employer-profile-create'),
    path('industries/', IndustryListView.as_view(), name='employer-industries'),
]
