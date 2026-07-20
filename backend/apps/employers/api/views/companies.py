from django.db import transaction
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import IsEmployer, IsEmployerWithMFA
from ...models import RecruiterProfile
from ...selectors import search_companies
from ...selectors import has_explicit_company_link
from ...services import get_or_create_recruiter
from ..serializers import CompanySearchSerializer, CompanySerializer
from .onboarding import _require_company


class MyCompanyView(generics.RetrieveAPIView):
    """Công ty của tôi — chỉ đọc; thay đổi thông tin đi qua update-requests."""

    serializer_class = CompanySerializer
    permission_classes = [IsEmployer]

    def get_object(self):
        return _require_company(self.request.user).company


class CreateCompanyView(generics.CreateAPIView):
    """Tạo hồ sơ công ty mới (thẻ 2) — có hiệu lực ngay, người tạo là owner."""

    serializer_class = CompanySerializer
    permission_classes = [IsEmployerWithMFA]

    @transaction.atomic
    def perform_create(self, serializer):
        get_or_create_recruiter(self.request.user)
        recruiter = RecruiterProfile.objects.select_for_update().get(user=self.request.user)
        if has_explicit_company_link(recruiter):
            raise ValidationError({'detail': 'Bạn đã liên kết với một công ty — không thể tạo hoặc đổi công ty khác.'})
        company = serializer.save(created_by=self.request.user)
        recruiter.company = company
        recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        recruiter.save(update_fields=['company', 'company_role', 'updated_at'])


class CompanySearchView(generics.ListAPIView):
    """Tìm công ty có sẵn (thẻ 1) theo tên, tên thương mại hoặc MST."""

    serializer_class = CompanySearchSerializer
    permission_classes = [IsEmployer]

    class Pagination(PageNumberPagination):
        page_size = 6
        page_size_query_param = None

    pagination_class = Pagination

    def get_queryset(self):
        return search_companies(self.request.query_params.get('q'))
