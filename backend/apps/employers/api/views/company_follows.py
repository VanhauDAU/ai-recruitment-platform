"""Candidates following a company page (ADR-0017)."""

from rest_framework import generics
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from ...selectors import (
    attach_active_public_job_counts,
    company_follow_state,
    followed_companies_queryset,
)
from ...services import follow_company, unfollow_company
from ..serializers import CompanyFollowWriteSerializer, FollowedCompanySerializer
from .company_page import get_visible_company


class CompanyFollowView(APIView):
    """Read, set or drop the caller's follow; PUT and DELETE are idempotent."""

    permission_classes = [IsCandidate]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'company_follow'

    def get_throttles(self):
        # Every company page view reads this state; only changes spend the budget.
        return [] if self.request.method in SAFE_METHODS else super().get_throttles()

    def _state(self, company):
        return Response(company_follow_state(company=company, candidate=self.request.user))

    def get(self, request, public_id):
        return self._state(get_visible_company(public_id))

    def put(self, request, public_id):
        company = get_visible_company(public_id)
        serializer = CompanyFollowWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        follow_company(
            company=company,
            candidate=request.user,
            notify_new_jobs=serializer.validated_data.get('notify_new_jobs'),
        )
        return self._state(company)

    def delete(self, request, public_id):
        company = get_visible_company(public_id)
        unfollow_company(company=company, candidate=request.user)
        return self._state(company)


class FollowedCompanyListView(generics.ListAPIView):
    permission_classes = [IsCandidate]
    serializer_class = FollowedCompanySerializer

    def get_queryset(self):
        return followed_companies_queryset(self.request.user)

    def paginate_queryset(self, queryset):
        # One grouped job count for the page instead of one per company.
        return attach_active_public_job_counts(super().paginate_queryset(queryset))
