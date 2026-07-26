"""HTTP adapter cho việc ứng viên báo cáo tin và quản trị viên kết luận."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasAdminPermission

from ...models import Job, JobReport
from ...selectors import job_report_queryset
from ...services import resolve_job_report, reverse_job_report, submit_job_report
from ..serializers import (
    AdminJobReportResolveSerializer,
    AdminJobReportReverseSerializer,
    AdminJobReportSerializer,
    JobReportCreateSerializer,
)


@extend_schema(
    summary='Ứng viên báo cáo một tin tuyển dụng',
    request=JobReportCreateSerializer,
    responses={201: AdminJobReportSerializer},
    tags=['jobs'],
)
class JobReportCreateView(APIView):
    # Bắt buộc đăng nhập: báo cáo ẩn danh không truy vết được và dễ bị lạm dụng
    # để hạ huy hiệu của đối thủ.
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, public_id):
        job = get_object_or_404(Job, public_id=public_id)
        serializer = JobReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = submit_job_report(
            job=job,
            reporter=request.user,
            reason=serializer.validated_data['reason'],
            detail=serializer.validated_data.get('detail', ''),
        )
        return Response(
            AdminJobReportSerializer(report).data,
            status=status.HTTP_201_CREATED,
        )


class AdminJobReportListView(generics.ListAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['job_moderation.view']}
    serializer_class = AdminJobReportSerializer

    def get_queryset(self):
        return job_report_queryset(status=self.request.query_params.get('status'))


@extend_schema(
    summary='Kết luận một báo cáo tin tuyển dụng',
    request=AdminJobReportResolveSerializer,
    responses={200: AdminJobReportSerializer},
    tags=['jobs'],
)
class AdminJobReportResolveView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['job_moderation.view', 'job_moderation.resolve_report']}

    def post(self, request, public_id):
        report = get_object_or_404(JobReport, public_id=public_id)
        serializer = AdminJobReportResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = resolve_job_report(
            report=report,
            status=serializer.validated_data['status'],
            actor=request.user,
            note=serializer.validated_data.get('note', ''),
        )
        return Response(AdminJobReportSerializer(report).data)


@extend_schema(
    summary='Gỡ kết luận vi phạm của một báo cáo tuyển dụng',
    request=AdminJobReportReverseSerializer,
    responses={200: AdminJobReportSerializer},
    tags=['jobs'],
)
class AdminJobReportReverseView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['job_moderation.view', 'job_moderation.resolve_report']}

    def post(self, request, public_id):
        report = get_object_or_404(JobReport, public_id=public_id)
        serializer = AdminJobReportReverseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = reverse_job_report(
            report=report,
            actor=request.user,
            note=serializer.validated_data['note'],
        )
        return Response(AdminJobReportSerializer(report).data)
