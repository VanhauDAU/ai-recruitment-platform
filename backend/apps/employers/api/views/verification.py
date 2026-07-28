import mimetypes
from io import BytesIO
from pathlib import PurePosixPath

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.http import FileResponse, Http404, HttpResponse
from drf_spectacular.utils import OpenApiTypes, extend_schema, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsEmployer
from common.media_storage import delete_local_media_url
from common.r2_storage import private_media_storage

from ...models import Company, CompanyDocument, CompanyUpdateRequest
from ...selectors import has_explicit_company_link
from ...services import (
    get_or_create_recruiter,
    queue_company_tax_lookup,
    render_office_document_preview,
    render_office_upload_preview,
)
from ..serializers import CompanyDocumentSerializer, CompanyUpdateRequestSerializer
from .memberships import (
    VERIFICATION_METHOD_DOCUMENT_TYPES,
    _save_document,
    remove_obsolete_verification_documents,
)
from .onboarding import _require_company


def employer_documents_queryset(user):
    """Documents visible to the authenticated recruiter; never expose R2 URLs."""
    recruiter = get_or_create_recruiter(user)
    # Keep recruiter-owned legacy rows visible while migrations/backfill attach
    # them to the account-specific verification case.
    candidate_dpa = Q(verification_case__recruiter=recruiter) | Q(recruiter=recruiter)
    if has_explicit_company_link(recruiter):
        queryset = CompanyDocument.objects.filter(
            candidate_dpa
            | Q(
                company=recruiter.company,
                update_request__isnull=False,
            )
            | Q(
                company=recruiter.company,
                verification_case__isnull=True,
                uploaded_by=user,
            )
        )
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
                'verification_method': serializers.ChoiceField(
                    choices=VERIFICATION_METHOD_DOCUMENT_TYPES,
                    required=False,
                ),
                'append': serializers.BooleanField(required=False),
                'replaces': serializers.CharField(required=False),
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
        verification_method = request.data.get('verification_method')
        if (
            verification_method
            and doc_type not in VERIFICATION_METHOD_DOCUMENT_TYPES[verification_method]
        ):
            raise ValidationError(
                {'verification_method': 'Phương thức xác thực không khớp loại giấy tờ.'}
            )
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
        if verification_method and update_request:
            raise ValidationError(
                {
                    'verification_method': 'Không dùng phương thức xác thực cho giấy tờ yêu cầu cập nhật.'
                }
            )
        try:
            append_to_current_set = serializers.BooleanField().run_validation(
                request.data.get('append', False)
            )
        except serializers.ValidationError as error:
            raise ValidationError({'append': 'Giá trị append không hợp lệ.'}) from error
        if append_to_current_set and (
            update_request is not None or doc_type != CompanyDocument.DocType.IDENTITY_DOCUMENT
        ):
            raise ValidationError(
                {'append': ('Chỉ được thêm nhiều tệp cho giấy tờ định danh của hồ sơ xác thực.')}
            )
        replace_document_public_id = (request.data.get('replaces') or '').strip()
        if append_to_current_set and replace_document_public_id:
            raise ValidationError(
                {'replaces': 'Không thể vừa thêm tệp mới vừa thay thế một tệp hiện hành.'}
            )
        if replace_document_public_id and update_request is not None:
            raise ValidationError(
                {'replaces': 'Yêu cầu cập nhật công ty chưa hỗ trợ thay thế tệp theo mã.'}
            )
        if source_type == 'website':
            website_url = (request.data.get('website_url') or '').strip()
            try:
                URLValidator(schemes=['http', 'https'])(website_url)
            except DjangoValidationError as error:
                raise ValidationError(
                    {'website_url': 'Nhập URL Website hợp lệ (http hoặc https).'}
                ) from error
            with transaction.atomic():
                existing = None
                if update_request is not None:
                    existing = (
                        CompanyDocument.objects.select_for_update()
                        .filter(
                            update_request=update_request,
                            doc_type=doc_type,
                            is_current=True,
                        )
                        .first()
                    )
                    if existing is not None:
                        existing.is_current = False
                        existing.save(update_fields=['is_current', 'updated_at'])
                document = CompanyDocument.objects.create(
                    company=_require_company(request.user).company,
                    recruiter=recruiter,
                    uploaded_by=request.user,
                    update_request=update_request,
                    supersedes=existing,
                    version=(existing.version + 1 if existing else 1),
                    doc_type=doc_type,
                    file_url=website_url,
                    file_name='Website chứng minh tên thương mại',
                )
        elif doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT:
            document = _save_document(
                request,
                None,
                doc_type,
                upload,
                recruiter=recruiter,
                replace_document_public_id=replace_document_public_id,
            )
        else:
            company = _require_company(request.user).company
            with transaction.atomic():
                document = _save_document(
                    request,
                    company,
                    doc_type,
                    upload,
                    update_request=update_request,
                    recruiter=recruiter,
                    verification_method=verification_method or '',
                    append_to_current_set=append_to_current_set,
                    replace_document_public_id=replace_document_public_id,
                )
                if verification_method:
                    remove_obsolete_verification_documents(
                        document.verification_case,
                        verification_method,
                    )
        serializer = self.get_serializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CompanyDocumentUploadPreviewView(generics.GenericAPIView):
    """Convert an unpersisted Word agreement to PDF for local pre-submit preview."""

    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser]

    @extend_schema(
        summary='Xem trước tệp Word thỏa thuận trước khi tải lên',
        request=inline_serializer(
            'CompanyDocumentUploadPreviewRequest',
            fields={'file': serializers.FileField()},
        ),
        responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
        tags=['employer-verification'],
    )
    def post(self, request):
        upload = request.FILES.get('file')
        if upload is None:
            raise ValidationError({'file': 'Vui lòng chọn tệp cần xem trước.'})
        max_size = getattr(settings, 'IMAGE_UPLOAD_MAX_SIZE', 5 * 1024 * 1024)
        if upload.size > max_size:
            raise ValidationError({'file': 'Văn bản phải nhỏ hơn 5 MB.'})

        content_type = (upload.content_type or '').partition(';')[0].strip().lower()
        signatures = {
            'application/msword': b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (
                b'PK\x03\x04'
            ),
        }
        if content_type not in signatures:
            content_type = {
                '.doc': 'application/msword',
                '.docx': (
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ),
            }.get(PurePosixPath(upload.name).suffix.lower(), content_type)
        signature = signatures.get(content_type)
        header = upload.read(16)
        upload.seek(0)
        if signature is None or not header.startswith(signature):
            raise ValidationError({'file': 'Chỉ hỗ trợ xem trước tệp DOC hoặc DOCX hợp lệ.'})

        preview = render_office_upload_preview(upload, content_type)
        if preview is None:
            raise ValidationError(
                {'file': 'Không thể tạo bản xem trước. Hãy kiểm tra lại nội dung tệp Word.'}
            )
        response = HttpResponse(preview, content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="document-preview.pdf"'
        response['Cache-Control'] = 'private, no-store'
        return response


@extend_schema(
    summary='Tải nội dung giấy tờ pháp lý đã nộp',
    responses={(200, 'application/octet-stream'): OpenApiTypes.BINARY},
    tags=['employer-verification'],
)
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
        stored_suffix = PurePosixPath(document.file_url).suffix
        filename = document.file_name or PurePosixPath(document.file_url).name
        if filename and not PurePosixPath(filename).suffix and stored_suffix:
            filename = f'{filename}{stored_suffix}'
        content_type = (document.mime_type or '').partition(';')[0].strip().lower()
        if not content_type or content_type in {'application/octet-stream', 'binary/octet-stream'}:
            content_type = mimetypes.guess_type(document.file_url)[0] or 'application/octet-stream'
        preview = render_office_document_preview(document.file_url, content_type)
        if preview is not None:
            stream.close()
            response = FileResponse(
                BytesIO(preview),
                content_type='application/pdf',
                filename=f'{document.public_id}.pdf',
                as_attachment=False,
            )
        else:
            response = FileResponse(
                stream,
                content_type=content_type,
                as_attachment=False,
                filename=filename or None,
            )
        response['Cache-Control'] = 'private, no-store'
        return response


class CompanyUpdateRequestListCreateView(generics.ListCreateAPIView):
    """Yêu cầu cập nhật công ty.

    POST đầu tiên tạo yêu cầu; các POST tiếp theo trong lúc chờ duyệt cập nhật
    chính record đó để người dùng luôn tiếp tục từ bản nháp gần nhất.
    """

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

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        recruiter = _require_company(self.request.user)
        company = Company.objects.select_for_update().get(pk=recruiter.company_id)
        pending = (
            CompanyUpdateRequest.objects.select_for_update()
            .filter(
                company=company,
                status=CompanyUpdateRequest.Status.PENDING,
            )
            .first()
        )
        serializer = self.get_serializer(pending, data=request.data)
        serializer.is_valid(raise_exception=True)
        previous = None
        staged_paths_to_delete = []
        if pending is not None:
            previous = {
                'changes': pending.changes,
                'reason': pending.reason,
                'proof_type': pending.proof_type,
            }
            pending.revision += 1
            pending.lock_version += 1
            next_changes = serializer.validated_data['changes']
            if 'logo_url' in pending.changes and not next_changes.get('has_no_logo'):
                next_changes['logo_url'] = pending.changes['logo_url']
            elif 'logo_url' in pending.changes:
                staged_paths_to_delete.append(pending.changes['logo_url'])
            if 'cover_image_url' in pending.changes:
                next_changes['cover_image_url'] = pending.changes['cover_image_url']
            if 'gallery_additions' in pending.changes:
                next_changes['gallery_additions'] = pending.changes['gallery_additions']
        update_request = serializer.save(
            company=company,
            requested_by=self.request.user,
            revision=pending.revision if pending is not None else 1,
            lock_version=pending.lock_version if pending is not None else 0,
            reviewed_by=None,
            reviewed_at=None,
            review_note='',
        )
        current = {
            'changes': update_request.changes,
            'reason': update_request.reason,
            'proof_type': update_request.proof_type,
        }
        if previous is not None and previous != current:
            update_request.documents.filter(is_current=True).update(
                status=CompanyDocument.Status.PENDING,
                reviewed_by=None,
                reviewed_at=None,
                review_note='',
            )
        if staged_paths_to_delete:

            def delete_discarded_media():
                for path in staged_paths_to_delete:
                    delete_local_media_url(path)

            transaction.on_commit(delete_discarded_media)
        update_request.refresh_from_db()
        if update_request.is_sensitive:
            proposed_tax_code = update_request.changes.get('tax_code', company.tax_code)
            try:
                queue_company_tax_lookup(
                    company=company,
                    requested_by=request.user,
                    update_request=update_request,
                    workflow_revision=update_request.revision,
                    tax_code=proposed_tax_code,
                    company_name=update_request.changes.get(
                        'company_name',
                        company.company_name,
                    ),
                )
            except ValueError:
                # The serializer rejects invalid new tax codes. This only
                # preserves manual review for malformed legacy company data.
                pass
        response = self.get_serializer(update_request)
        return Response(
            response.data,
            status=status.HTTP_200_OK if pending is not None else status.HTTP_201_CREATED,
        )
