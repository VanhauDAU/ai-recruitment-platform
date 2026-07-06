from django.urls import path

from .views import CvTemplateDetailView, CvTemplateListView

urlpatterns = [
    path('', CvTemplateListView.as_view(), name='cv-template-list'),
    path('<slug:slug>/', CvTemplateDetailView.as_view(), name='cv-template-detail'),
]
