from django.db.models import Case, IntegerField, Q, Value, When
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.http import FileResponse, Http404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, status
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsEmployer
from common.r2_storage import private_media_storage

from ...models import CompanyDocument, CompanyUpdateRequest
from ...selectors import has_explicit_company_link
from ...services import get_or_create_recruiter
from ..serializers import CompanyDocumentSerializer, CompanyUpdateRequestSerializer
from .memberships import _save_document
from .onboarding import _require_company


def employer_documents_queryset(user):
    """Documents visible to the authenticated recruiter; never expose R2 URLs."""
    recruiter = get_or_create_recruiter(user)
    candidate_dpa = Q(
        doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        recruiter=recruiter,
    )
    if has_explicit_company_link(recruiter):
        candidate_dpa |= Q(
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            company=recruiter.company,
        )
        queryset = CompanyDocument.objects.filter(Q(company=recruiter.company) | candidate_dpa)
    else:
        queryset = CompanyDocument.objects.filter(candidate_dpa)
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
    )


class CompanyDocumentListCreateView(generics.ListCreateAPIView):
    """Giấy tờ của công ty tôi, gồm file và URL chứng minh tên thương mại."""

    serializer_class = CompanyDocumentSerializer
    # Tài liệu vẫn thuộc phiên employer đang đăng nhập, nhưng không bắt buộc
    # MFA/xác thực lại: mọi tệp đều quay về trạng thái chờ duyệt khi được thay.
    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser]
    pagination_class = None

    def get_queryset(self):
        # Văn bản DLCN mới gắn với recruiter thay thế bản lịch sử từng gắn với
        # company. API phải trả bản mới trước để consumer không vô tình mở tệp
        # công ty cũ khi cả hai cùng tồn tại.
        return employer_documents_queryset(self.request.user).order_by(
            'dpa_owner_priority',
            '-created_at',
            '-id',
        )

    @extend_schema(
        summary='Tải giấy tờ công ty hoặc hồ sơ chứng minh cho yêu cầu cập nhật',
        request=inline_serializer(
            'CompanyDocumentUploadRequest',
            fields={
                'doc_type': serializers.ChoiceField(choices=CompanyDocument.DocType.choices),
                'file': serializers.FileField(required=False),
                'source_type': serializers.ChoiceField(choices=['file', 'website'], required=False),
                'website_url': serializers.URLField(required=False),
                'update_request': serializers.CharField(required=False),
            },
        ),
        responses={201: CompanyDocumentSerializer},
        tags=['employer'],
    )
    def create(self, request, *args, **kwargs):
        doc_type = request.data.get('doc_type')
        if doc_type not in CompanyDocument.DocType.values:
            raise ValidationError({'doc_type': 'Loại giấy tờ không hợp lệ.'})
        upload = request.FILES.get('file')
        source_type = request.data.get('source_type', 'file')
        if source_type not in {'file', 'website'}:
            raise ValidationError({'source_type': 'Nguồn chứng minh không hợp lệ.'})
        if source_type == 'website' and doc_type != CompanyDocument.DocType.TRADE_NAME_PROOF:
            raise ValidationError(
                {'source_type': 'Chỉ chứng minh tên thương mại được dùng Website.'}
            )
        if source_type == 'file' and not upload:
            raise ValidationError({'file': 'Vui lòng chọn tệp chứng minh.'})
        if source_type == 'website' and upload:
            raise ValidationError({'file': 'Không tải tệp khi chọn nguồn Website.'})
        recruiter = get_or_create_recruiter(request.user)
        update_request = None
        update_request_id = request.data.get('update_request')
        if update_request_id:
            recruiter = _require_company(request.user)
            update_request = CompanyUpdateRequest.objects.filter(
                public_id=update_request_id,
                company=recruiter.company,
                status=CompanyUpdateRequest.Status.PENDING,
            ).first()
            if update_request is None:
                raise ValidationError(
                    {'update_request': 'Không tìm thấy yêu cầu cập nhật đang chờ.'}
                )
        if source_type == 'website':
            website_url = (request.data.get('website_url') or '').strip()
            try:
                URLValidator(schemes=['http', 'https'])(website_url)
            except DjangoValidationError as error:
                raise ValidationError(
                    {'website_url': 'Nhập URL Website hợp lệ (http hoặc https).'}
                ) from error
            document = CompanyDocument.objects.create(
                company=_require_company(request.user).company,
                uploaded_by=request.user,
                update_request=update_request,
                doc_type=doc_type,
                file_url=website_url,
                file_name='Website chứng minh tên thương mại',
            )
        elif doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT:
            document = _save_document(request, None, doc_type, upload, recruiter=recruiter)
        else:
            document = _save_document(
                request,
                _require_company(request.user).company,
                doc_type,
                upload,
                update_request=update_request,
            )
        serializer = self.get_serializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CompanyDocumentContentView(generics.GenericAPIView):
    """Authorized private-file download for the employer's own documents."""

    permission_classes = [IsEmployer]

    def get(self, request, pk):
        document = employer_documents_queryset(request.user).filter(pk=pk).first()
        if document is None or document.file_url.startswith(('http://', 'https://')):
            raise Http404
        try:
            stream = private_media_storage().open(document.file_url, 'rb')
        except OSError as error:
            raise Http404 from error
        return FileResponse(stream, as_attachment=False, filename=document.file_name or None)


class CompanyUpdateRequestListCreateView(generics.ListCreateAPIView):
    """Yêu cầu cập nhật công ty của tôi (mọi thành viên đã liên kết tạo được)."""

    serializer_class = CompanyUpdateRequestSerializer
    permission_classes = [IsEmployer]
    pagination_class = None

    def get_queryset(self):
        return CompanyUpdateRequest.objects.filter(
            company=_require_company(self.request.user).company
        ).order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['company'] = _require_company(self.request.user).company
        return context

    def perform_create(self, serializer):
        recruiter = _require_company(self.request.user)
        if CompanyUpdateRequest.objects.filter(
            company=recruiter.company, status=CompanyUpdateRequest.Status.PENDING
        ).exists():
            raise ValidationError({'detail': 'Công ty đang có một yêu cầu cập nhật chờ duyệt.'})
        serializer.save(company=recruiter.company, requested_by=self.request.user)
