from django.urls import path

from .api.views.legacy import (
    CandidateApplicationListCreateView,
    EmployerApplicationListView,
    EmployerApplicationStatusUpdateView,
)

urlpatterns = [
    path('', CandidateApplicationListCreateView.as_view(), name='application-list-create'),
    path('employer/', EmployerApplicationListView.as_view(), name='employer-application-list'),
    path(
        'employer/<str:public_id>/',
        EmployerApplicationStatusUpdateView.as_view(),
        name='employer-application-status',
    ),
]
