from django.urls import path

from .views import (
    AdminConsultationLeadDetailView,
    AdminConsultationLeadListView,
    AdminServiceCategoryDetailView,
    AdminServiceCategoryListCreateView,
    AdminServicePackageDetailView,
    AdminServicePackageListCreateView,
    ConsultationLeadCreateView,
    PublicServicePackageListView,
)

urlpatterns = [
    path('packages/', PublicServicePackageListView.as_view(), name='services-packages'),
    path('consultations/', ConsultationLeadCreateView.as_view(), name='services-consultations'),
    path(
        'admin/categories/',
        AdminServiceCategoryListCreateView.as_view(),
        name='services-admin-categories',
    ),
    path(
        'admin/categories/<int:pk>/',
        AdminServiceCategoryDetailView.as_view(),
        name='services-admin-category-detail',
    ),
    path(
        'admin/packages/',
        AdminServicePackageListCreateView.as_view(),
        name='services-admin-packages',
    ),
    path(
        'admin/packages/<int:pk>/',
        AdminServicePackageDetailView.as_view(),
        name='services-admin-package-detail',
    ),
    path(
        'admin/consultations/',
        AdminConsultationLeadListView.as_view(),
        name='services-admin-consultations',
    ),
    path(
        'admin/consultations/<int:pk>/',
        AdminConsultationLeadDetailView.as_view(),
        name='services-admin-consultation-detail',
    ),
]
