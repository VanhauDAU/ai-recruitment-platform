"""Anonymous reads behind the public company page (ADR-0017)."""

from django.utils.translation import gettext_lazy
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from common.api.throttling import ClientIPScopedRateThrottle

from ...selectors import (
    build_public_company_profile,
    public_company_job_locations,
    similar_public_companies,
    visible_company_by_public_id,
    visible_company_page_by_slug,
)
from ..serializers import PublicCompanyListSerializer

# A held page answers exactly like an unknown one so moderation state never leaks.
COMPANY_NOT_FOUND = gettext_lazy('Không tìm thấy công ty.')


def get_visible_company(public_id):
    company = visible_company_by_public_id(public_id)
    if company is None:
        raise NotFound(COMPANY_NOT_FOUND)
    return company


class PublicCompanyPageView(APIView):
    """Shares the directory throttle: one client budget for all company reads."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'public_companies'


class PublicCompanyDetailView(PublicCompanyPageView):
    @extend_schema(
        summary='Hồ sơ trang công ty công khai',
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request, slug):
        company = visible_company_page_by_slug(slug)
        if company is None:
            raise NotFound(COMPANY_NOT_FOUND)
        return Response(build_public_company_profile(company, request=request))


class PublicCompanySimilarView(PublicCompanyPageView):
    @extend_schema(
        summary='Công ty tương tự',
        responses={
            200: inline_serializer(
                'PublicSimilarCompanies',
                fields={'results': PublicCompanyListSerializer(many=True)},
            )
        },
    )
    def get(self, request, public_id):
        companies = similar_public_companies(get_visible_company(public_id))
        serializer = PublicCompanyListSerializer(
            companies,
            many=True,
            context={'request': request},
        )
        return Response({'results': serializer.data})


class PublicCompanyJobFacetsView(PublicCompanyPageView):
    @extend_schema(
        summary='Địa điểm có tin tuyển dụng của công ty',
        responses={
            200: inline_serializer(
                'PublicCompanyJobFacets',
                fields={'locations': serializers.ListField(child=serializers.DictField())},
            )
        },
    )
    def get(self, request, public_id):
        company = get_visible_company(public_id)
        return Response({'locations': public_company_job_locations(company)})
