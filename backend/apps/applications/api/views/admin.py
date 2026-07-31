"""Administrator reads for applications attached to a moderated job."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics

from apps.accounts.permissions import HasAdminPermission
from apps.jobs.models import Job

from ...selectors import admin_job_applications_queryset
from ..serializers import AdminJobApplicationSerializer


@extend_schema(
    summary='Danh sách ứng viên đã ứng tuyển vào một tin dành cho quản trị viên',
    parameters=[
        OpenApiParameter('q', str),
        OpenApiParameter('status', str),
        OpenApiParameter('source', str),
        OpenApiParameter('submitted_from', str),
        OpenApiParameter('submitted_to', str),
        OpenApiParameter('ordering', str, enum=['newest', 'oldest', 'name', 'status']),
    ],
    responses={200: AdminJobApplicationSerializer(many=True)},
    tags=['applications-admin'],
)
class AdminJobApplicationListView(generics.ListAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': [
            'job_moderation.view',
            'job_moderation.view_sensitive_contact',
        ]
    }
    serializer_class = AdminJobApplicationSerializer

    def get_queryset(self):
        job = get_object_or_404(Job, public_id=self.kwargs['job_public_id'])
        return admin_job_applications_queryset(job, params=self.request.query_params)
