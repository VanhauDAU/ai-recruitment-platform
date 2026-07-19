from rest_framework import generics, parsers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsEmployerWithMFA, IsEmployerWithRecentReauthentication

from ...models import CompanyDocument, CompanyUpdateRequest
from ..serializers import CompanyDocumentSerializer, CompanyUpdateRequestSerializer
from .memberships import _save_document
from .onboarding import _require_company, _require_owner


class CompanyDocumentListCreateView(generics.ListCreateAPIView):
    """Giấy tờ của công ty tôi. POST multipart: `doc_type` + `file`."""

    serializer_class = CompanyDocumentSerializer
    permission_classes = [IsEmployerWithRecentReauthentication]
    parser_classes = [parsers.MultiPartParser]
    pagination_class = None

    def get_queryset(self):
        return CompanyDocument.objects.filter(company=_require_company(self.request.user).company)

    def create(self, request, *args, **kwargs):
        company = _require_company(request.user).company
        doc_type = request.data.get('doc_type')
        if doc_type not in CompanyDocument.DocType.values:
            raise ValidationError({'doc_type': 'Loại giấy tờ không hợp lệ.'})
        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': 'This field is required.'})
        document = _save_document(request, company, doc_type, upload)
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
