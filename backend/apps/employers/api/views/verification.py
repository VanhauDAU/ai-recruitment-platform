from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import generics, parsers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsEmployer, IsEmployerWithMFA

from ...models import CompanyDocument, CompanyUpdateRequest
from ...selectors import has_explicit_company_link
from ...services import get_or_create_recruiter
from ..serializers import CompanyDocumentSerializer, CompanyUpdateRequestSerializer
from .memberships import _save_document
from .onboarding import _require_company, _require_owner


class CompanyDocumentListCreateView(generics.ListCreateAPIView):
    """Giấy tờ của công ty tôi. POST multipart: `doc_type` + `file`."""

    serializer_class = CompanyDocumentSerializer
    # Tài liệu vẫn thuộc phiên employer đang đăng nhập, nhưng không bắt buộc
    # MFA/xác thực lại: mọi tệp đều quay về trạng thái chờ duyệt khi được thay.
    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser]
    pagination_class = None

    def get_queryset(self):
        recruiter = get_or_create_recruiter(self.request.user)
        candidate_dpa = Q(
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            recruiter=recruiter,
        )
        if has_explicit_company_link(recruiter):
            # Giữ các văn bản DLCN lịch sử từng được lưu theo công ty.
            candidate_dpa |= Q(
                doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                company=recruiter.company,
            )
            queryset = CompanyDocument.objects.filter(Q(company=recruiter.company) | candidate_dpa)
        else:
            queryset = CompanyDocument.objects.filter(candidate_dpa)

        # Văn bản DLCN mới gắn với recruiter thay thế bản lịch sử từng gắn với
        # company. API phải trả bản mới trước để consumer không vô tình mở tệp
        # công ty cũ khi cả hai cùng tồn tại.
        return queryset.annotate(
            dpa_owner_priority=Case(
                When(
                    doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                    recruiter=recruiter,
                    then=Value(0),
                ),
                When(
                    doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                    then=Value(1),
                ),
                default=Value(0),
                output_field=IntegerField(),
            ),
        ).order_by('dpa_owner_priority', '-created_at', '-id')

    def create(self, request, *args, **kwargs):
        doc_type = request.data.get('doc_type')
        if doc_type not in CompanyDocument.DocType.values:
            raise ValidationError({'doc_type': 'Loại giấy tờ không hợp lệ.'})
        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': 'This field is required.'})
        recruiter = get_or_create_recruiter(request.user)
        if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT:
            document = _save_document(request, None, doc_type, upload, recruiter=recruiter)
        else:
            document = _save_document(request, _require_company(request.user).company, doc_type, upload)
        serializer = self.get_serializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CompanyUpdateRequestListCreateView(generics.ListCreateAPIView):
    """Yêu cầu cập nhật thông tin công ty của tôi (owner tạo, admin duyệt)."""

    serializer_class = CompanyUpdateRequestSerializer
    permission_classes = [IsEmployerWithMFA]
    pagination_class = None

    def get_queryset(self):
        return CompanyUpdateRequest.objects.filter(
            company=_require_company(self.request.user).company
        ).order_by('-created_at')

    def perform_create(self, serializer):
        recruiter = _require_owner(self.request.user)
        if CompanyUpdateRequest.objects.filter(
            company=recruiter.company, status=CompanyUpdateRequest.Status.PENDING
        ).exists():
            raise ValidationError({'detail': 'Công ty đang có một yêu cầu cập nhật chờ duyệt.'})
        serializer.save(company=recruiter.company, requested_by=self.request.user)
