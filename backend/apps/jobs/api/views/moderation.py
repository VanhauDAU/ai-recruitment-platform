"""HTTP adapters for administrator job management and moderation."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import (
    HasAdminPermission,
    has_admin_permission,
    require_admin_permission,
)
from apps.employers.services import recruiter_job_posting_entitlement

from ...models import JobReport
from ...selectors import (
    admin_job_detail_queryset,
    admin_job_management_queryset,
    admin_job_management_summary,
    job_moderation_queryset,
)
from ...services import (
    approve_job,
    hide_job_visibility,
    reject_job,
    restore_job_visibility,
)
from ..serializers import (
    AdminJobDecisionSerializer,
    AdminJobDetailSerializer,
    AdminJobManagementListSerializer,
    AdminJobModerationSerializer,
    AdminJobReviewSerializer,
)


def _job_detail_response(job, user):
    _, entitlement = recruiter_job_posting_entitlement(job.posted_by)
    serializer = AdminJobDetailSerializer(
        job,
        context={
            'can_view_sensitive_contact': has_admin_permission(
                user,
                'job_moderation.view_sensitive_contact',
            ),
            'employer_entitlement': entitlement,
        },
    )
    return Response(serializer.data)


@extend_schema(
    summary='Danh sách tin tuyển dụng dành cho quản trị viên',
    parameters=[
        OpenApiParameter('q', str),
        OpenApiParameter('scope', str, enum=['expired', 'held']),
        OpenApiParameter('status', str),
        OpenApiParameter('company', str),
        OpenApiParameter('employer', str),
        OpenApiParameter('tier', str),
        OpenApiParameter('policy_hold', str),
        OpenApiParameter('moderation_hold', str),
        OpenApiParameter('has_reports', bool),
        OpenApiParameter('submitted_from', str),
        OpenApiParameter('submitted_to', str),
        OpenApiParameter('deadline_from', str),
        OpenApiParameter('deadline_to', str),
        OpenApiParameter('ordering', str),
    ],
    responses={200: AdminJobManagementListSerializer(many=True)},
    tags=['jobs-admin'],
)
class AdminJobModerationListView(generics.ListAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['job_moderation.view']}
    serializer_class = AdminJobManagementListSerializer

    def get_queryset(self):
        return admin_job_management_queryset(params=self.request.query_params)


@extend_schema(
    summary='Tổng quan vận hành tin tuyển dụng',
    responses={200: dict},
    tags=['jobs-admin'],
)
class AdminJobModerationSummaryView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['job_moderation.view']}

    def get(self, request):
        return Response(admin_job_management_summary())


@extend_schema(
    summary='Chi tiết tin tuyển dụng dành cho quản trị viên',
    responses={200: AdminJobDetailSerializer},
    tags=['jobs-admin'],
)
class AdminJobModerationDetailView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['job_moderation.view']}

    def get(self, request, public_id):
        job = get_object_or_404(admin_job_detail_queryset(), public_id=public_id)
        return _job_detail_response(job, request.user)


@extend_schema(
    summary='Ghi nhận quyết định kiểm duyệt tin tuyển dụng',
    request=AdminJobDecisionSerializer,
    responses={200: AdminJobDetailSerializer},
    tags=['jobs-admin'],
)
class AdminJobDecisionView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['job_moderation.view']}

    action_permissions = {
        'approve': 'job_moderation.approve',
        'reject': 'job_moderation.reject',
        'hide': 'job_moderation.enforce_visibility',
        'restore': 'job_moderation.enforce_visibility',
    }

    def post(self, request, public_id):
        job = get_object_or_404(admin_job_detail_queryset(), public_id=public_id)
        serializer = AdminJobDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        action = payload['action']
        require_admin_permission(request.user, self.action_permissions[action])

        source_report = None
        if source_report_public_id := payload.get('source_report_public_id'):
            source_report = get_object_or_404(JobReport, public_id=source_report_public_id)

        if action == 'approve':
            approve_job(
                job=job,
                user=request.user,
                review_token=payload['review_token'],
            )
        elif action == 'reject':
            reject_job(
                job=job,
                user=request.user,
                reason=payload['note'],
                reason_code=payload.get('reason_code', ''),
                review_token=payload['review_token'],
            )
        elif action == 'hide':
            hide_job_visibility(
                job=job,
                user=request.user,
                reason_code=payload['reason_code'],
                note=payload['note'],
                review_token=payload['review_token'],
                hold=payload.get('hold'),
                source_report=source_report,
            )
        else:
            restore_job_visibility(
                job=job,
                user=request.user,
                note=payload['note'],
                review_token=payload['review_token'],
            )

        refreshed = get_object_or_404(admin_job_detail_queryset(), public_id=public_id)
        return _job_detail_response(refreshed, request.user)


class AdminJobReviewView(APIView):
    """Backward-compatible endpoint retained for existing admin clients."""

    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['job_moderation.view']}

    def post(self, request, public_id):
        job = get_object_or_404(job_moderation_queryset(), public_id=public_id)
        serializer = AdminJobReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decided = serializer.validated_data['action']
        require_admin_permission(request.user, f'job_moderation.{decided}')
        if decided == 'approve':
            job = approve_job(job=job, user=request.user)
        else:
            job = reject_job(
                job=job,
                user=request.user,
                reason=serializer.validated_data.get('reason', ''),
            )
        return Response(AdminJobModerationSerializer(job).data)
