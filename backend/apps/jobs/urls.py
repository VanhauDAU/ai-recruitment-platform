from django.urls import path

from .views import (
    EmployerJobDetailView,
    EmployerJobListCreateView,
    JobCategoryListView,
    JobDetailView,
    JobListView,
    JobStatsView,
)

urlpatterns = [
    path('categories/', JobCategoryListView.as_view(), name='job-category-list'),
    path('stats/', JobStatsView.as_view(), name='job-stats'),
    path('mine/', EmployerJobListCreateView.as_view(), name='employer-job-list-create'),
    path('mine/<str:public_id>/', EmployerJobDetailView.as_view(), name='employer-job-detail'),
    path('', JobListView.as_view(), name='job-list'),
    path('<slug:slug>/', JobDetailView.as_view(), name='job-detail'),
]
