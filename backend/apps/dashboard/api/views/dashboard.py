from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import AdminPortalPermission, IsEmployer
from apps.employers.services import get_or_create_recruiter

from ...selectors import (
    DASHBOARD_PERIODS,
    build_admin_dashboard,
    build_employer_dashboard,
    normalize_dashboard_period,
)
from ..serializers import AdminDashboardSerializer, EmployerDashboardSerializer


class EmployerDashboardView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Tổng quan workspace nhà tuyển dụng',
        responses={200: EmployerDashboardSerializer},
        tags=['employer-dashboard'],
    )
    def get(self, request):
        # Older employer accounts can predate RecruiterProfile. Create the
        # minimal profile at the HTTP mutation boundary so the dashboard
        # selector remains read-only and never turns a recoverable data gap
        # into a 500 response.
        get_or_create_recruiter(request.user)
        return Response(build_employer_dashboard(request.user))


class AdminDashboardView(APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(
        summary='Bảng điều khiển cổng quản trị',
        parameters=[
            OpenApiParameter(
                'period',
                int,
                description='Số ngày của kỳ thống kê',
                enum=list(DASHBOARD_PERIODS),
            )
        ],
        responses={200: AdminDashboardSerializer},
        tags=['admin-dashboard'],
    )
    def get(self, request):
        days = normalize_dashboard_period(request.query_params.get('period'))
        return Response(AdminDashboardSerializer(build_admin_dashboard(days=days)).data)
