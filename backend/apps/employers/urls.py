from django.urls import path

from .views import (
    CreateEmployerProfileView,
    EmployerCoverUploadView,
    EmployerLogoUploadView,
    IndustryListView,
    MyEmployerProfileView,
)

urlpatterns = [
    path('profile/', MyEmployerProfileView.as_view(), name='employer-profile'),
    path('profile/create/', CreateEmployerProfileView.as_view(), name='employer-profile-create'),
    path('profile/logo/', EmployerLogoUploadView.as_view(), name='employer-profile-logo-upload'),
    path('profile/cover/', EmployerCoverUploadView.as_view(), name='employer-profile-cover-upload'),
    path('industries/', IndustryListView.as_view(), name='employer-industries'),
]
