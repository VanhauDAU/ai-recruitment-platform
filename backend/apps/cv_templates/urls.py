from django.urls import path

from .api.views.legacy import CvTemplateDetailView, CvTemplateListView

urlpatterns = [
    path('', CvTemplateListView.as_view(), name='cv-template-list'),
    path('<slug:slug>/', CvTemplateDetailView.as_view(), name='cv-template-detail'),
]
