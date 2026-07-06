from django.urls import path

from .views import CreateEmployerProfileView, MyEmployerProfileView

urlpatterns = [
    path('profile/', MyEmployerProfileView.as_view(), name='employer-profile'),
    path('profile/create/', CreateEmployerProfileView.as_view(), name='employer-profile-create'),
]
