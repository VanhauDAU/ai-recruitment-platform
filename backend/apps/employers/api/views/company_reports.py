"""Candidates reporting wrong information on a company page (ADR-0017)."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from ...services import submit_company_report
from ..serializers import CompanyReportCreatedSerializer, CompanyReportCreateSerializer
from .company_page import get_visible_company


class CompanyReportCreateView(APIView):
    # Signed-in candidates only: an anonymous report cannot be traced or
    # deduplicated, and employers must not report their competitors.
    permission_classes = [IsCandidate]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'company_report'

    def post(self, request, public_id):
        company = get_visible_company(public_id)
        serializer = CompanyReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = submit_company_report(
            company=company,
            reporter=request.user,
            **serializer.validated_data,
        )
        return Response(
            CompanyReportCreatedSerializer(report).data,
            status=status.HTTP_201_CREATED,
        )
