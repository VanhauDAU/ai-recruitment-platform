from rest_framework import generics
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import IsEmployer
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
    permission_classes = [IsEmployer]

    def perform_create(self, serializer):
        recruiter = get_or_create_recruiter(self.request.user)
        if recruiter.phone_verified_at is None:
            raise ValidationError({'detail': 'Xác thực số điện thoại trước khi cập nhật thông tin công ty.'})
        if has_explicit_company_link(recruiter):
            raise ValidationError({'detail': 'Bạn đã liên kết với một công ty — không thể tạo hoặc đổi công ty khác.'})
        company = serializer.save(created_by=self.request.user)
        recruiter.company = company
        recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        recruiter.membership_status = RecruiterProfile.MembershipStatus.APPROVED
        recruiter.save(update_fields=['company', 'company_role', 'membership_status', 'updated_at'])


class CompanySearchView(generics.ListAPIView):
    """Tìm công ty có sẵn (thẻ 1) theo tên, tên thương mại hoặc MST."""

    serializer_class = CompanySearchSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return search_companies(self.request.query_params.get('q'))
