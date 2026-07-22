from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.employers.services import get_or_create_recruiter

from ...selectors import build_employer_dashboard
from ..serializers import EmployerDashboardSerializer


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
