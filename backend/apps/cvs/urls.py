from django.urls import path

from .views import UserCvDetailView, UserCvListCreateView, UserCvUploadView

urlpatterns = [
    path('', UserCvListCreateView.as_view(), name='cv-list-create'),
    path('upload/', UserCvUploadView.as_view(), name='cv-upload'),
    path('<str:public_id>/', UserCvDetailView.as_view(), name='cv-detail'),
]
