from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from .selectors import build_employer_dashboard
from .serializers import EmployerDashboardSerializer


class EmployerDashboardView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Tổng quan workspace nhà tuyển dụng',
        responses={200: EmployerDashboardSerializer},
        tags=['employer-dashboard'],
    )
    def get(self, request):
        return Response(build_employer_dashboard(request.user))
