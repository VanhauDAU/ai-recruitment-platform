import mimetypes
from io import BytesIO
from pathlib import PurePosixPath

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.http import FileResponse, Http404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

from apps.accounts.api.permissions import IsEmployer
from common.files.office_preview import render_office_document_preview
from common.storage.r2 import private_media_storage

from ...models import CompanyDocument, CompanyUpdateRequest
from ...models.page_access import resolve_company_page_access
from ...selectors import (
    company_update_request_for_company,
    company_update_requests_queryset,
    employer_document_content_queryset,
    employer_document_metadata_queryset,
    existing_recruiter_profile,
    requester_editable_company_update_request,
)
from ...services import (
    VERIFICATION_METHOD_DOCUMENT_TYPES,
    CompanyUpdateConflict,
    CompanyUpdateInReview,
    close_company_update_before_review,
    get_or_create_recruiter,
    save_company_document,
    save_company_website_proof,
    submit_validated_company_update,
)
from ..exceptions import (
    COMPANY_UPDATE_IN_REVIEW,
    CompanyUpdateConflictResponse,
    UploadPreviewScanRequiredResponse,
    UploadSessionRequiredResponse,
)
from ..permissions import require_company_recruiter
from ..serializers import (
    CompanyDocumentSerializer,
    CompanyUpdateRequestCloseSerializer,
    CompanyUpdateRequestSerializer,
)


class CompanyDocumentListCreateView(generics.ListCreateAPIView):
    """Giấy tờ của công ty tôi, gồm file và URL chứng minh tên thương mại."""

    serializer_class = CompanyDocumentSerializer
    # Tài liệu vẫn thuộc phiên employer đang đăng nhập, không bắt buộc xác thực
    # lại: mọi tệp đều quay về trạng thái chờ duyệt khi được thay.
    permission_classes = [IsEmployer]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser]
    pagination_class = None

    def get_recruiter(self):
        if not hasattr(self, '_recruiter'):
            # Listing never creates the profile; an upload needs one to own the file.
            self._recruiter = (
                existing_recruiter_profile(self.request.user)
                if self.request.method in SAFE_METHODS
                else get_or_create_recruiter(self.request.user)
            )
        return self._recruiter

    @extend_schema(
        summary='Giấy tờ công ty và hồ sơ chứng minh actor được xem',
        responses={200: CompanyDocumentSerializer(many=True)},
        tags=['employer'],
        parameters=[
            OpenApiParameter(
                'scope',
                OpenApiTypes.STR,
                OpenApiParameter.QUERY,
                enum=['mine'],
                description=(
                    'mine: chỉ giấy tờ thuộc hồ sơ của recruiter hiện tại; '
                    'bỏ trống để giữ phạm vi tài liệu mà actor có quyền xem.'
                ),
            )
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        scope = self.request.query_params.get('scope', '')
        if scope not in {'', 'mine'}:
            raise ValidationError({'scope': 'Phạm vi phải là mine hoặc để trống.'})
        recruiter = self.get_recruiter()
        if recruiter is None:
            return CompanyDocument.objects.none()
        # Văn bản DLCN mới gắn với recruiter thay thế bản lịch sử từng gắn với
        # company. API phải trả bản mới trước để consumer không vô tình mở tệp
        # công ty cũ khi cả hai cùng tồn tại.
        return employer_document_metadata_queryset(
            user=self.request.user,
            recruiter=recruiter,
            personal_only=scope == 'mine',
        ).order_by(
            'dpa_owner_priority',
            '-created_at',
            '-id',
        )

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            'recruiter': self.get_recruiter(),
        }

    @extend_schema(
        summary='Tải giấy tờ công ty hoặc hồ sơ chứng minh cho yêu cầu cập nhật',
        request=inline_serializer(
            'CompanyDocumentUploadRequest',
            fields={
                'doc_type': serializers.ChoiceField(choices=CompanyDocument.DocType.choices),
                'file': serializers.FileField(required=False),
                'upload_session': serializers.CharField(required=False),
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
    def post(self, request, *args, **kwargs):
        doc_type = request.data.get('doc_type')
        if doc_type not in CompanyDocument.DocType.values:
            raise ValidationError({'doc_type': 'Loại giấy tờ không hợp lệ.'})
        upload = request.FILES.get('file')
        upload_session_public_id = (request.data.get('upload_session') or '').strip()
        source_type = request.data.get('source_type', 'file')
        if source_type not in {'file', 'website'}:
            raise ValidationError({'source_type': 'Nguồn chứng minh không hợp lệ.'})
        if source_type == 'website' and doc_type != CompanyDocument.DocType.TRADE_NAME_PROOF:
            raise ValidationError(
                {'source_type': 'Chỉ chứng minh tên thương mại được dùng Website.'}
            )
        if source_type == 'file' and not upload and not upload_session_public_id:
            raise ValidationError({'file': 'Vui lòng chọn tệp chứng minh.'})
        if upload and upload_session_public_id:
            raise ValidationError(
                {'upload_session': 'Không thể gửi đồng thời file thô và upload session.'}
            )
        if upload and settings.EMPLOYER_UPLOAD_SESSION_REQUIRED:
            raise UploadSessionRequiredResponse()
        if source_type == 'website' and upload:
            raise ValidationError({'file': 'Không tải tệp khi chọn nguồn Website.'})
        if source_type == 'website' and upload_session_public_id:
            raise ValidationError(
                {'upload_session': 'Không dùng upload session khi chọn nguồn Website.'}
            )
        verification_method = request.data.get('verification_method')
        if (
            verification_method
            and doc_type not in VERIFICATION_METHOD_DOCUMENT_TYPES[verification_method]
        ):
            raise ValidationError(
                {'verification_method': 'Phương thức xác thực không khớp loại giấy tờ.'}
            )
        recruiter = self.get_recruiter()
        update_request = None
        update_request_id = request.data.get('update_request')
        if update_request_id:
            recruiter = require_company_recruiter(request.user)
            update_request = requester_editable_company_update_request(
                company=recruiter.company,
                requester=request.user,
                public_id=update_request_id,
            )
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
        if source_type == 'website':
            website_url = (request.data.get('website_url') or '').strip()
            try:
                URLValidator(schemes=['http', 'https'])(website_url)
            except DjangoValidationError as error:
                raise ValidationError(
                    {'website_url': 'Nhập URL Website hợp lệ (http hoặc https).'}
                ) from error
            document = save_company_website_proof(
                user=request.user,
                recruiter=recruiter,
                website_url=website_url,
                update_request=update_request,
                company=(
                    None if update_request else require_company_recruiter(request.user).company
                ),
            )
        elif doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT:
            document = save_company_document(
                user=request.user,
                recruiter=recruiter,
                company=None,
                doc_type=doc_type,
                upload=upload,
                upload_session_public_id=upload_session_public_id,
                replace_document_public_id=replace_document_public_id,
            )
        else:
            document = save_company_document(
                user=request.user,
                recruiter=recruiter,
                company=require_company_recruiter(request.user).company,
                doc_type=doc_type,
                upload=upload,
                upload_session_public_id=upload_session_public_id,
                update_request=update_request,
                verification_method=verification_method or '',
                append_to_current_set=append_to_current_set,
                replace_document_public_id=replace_document_public_id,
            )
        serializer = self.get_serializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CompanyDocumentUploadPreviewView(generics.GenericAPIView):
    """Fail closed until an upload-session scan can authorize Office preview."""

    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser]

    @extend_schema(
        summary='Xem trước tệp Word thỏa thuận trước khi tải lên',
        request=inline_serializer(
            'CompanyDocumentUploadPreviewRequest',
            fields={'file': serializers.FileField()},
        ),
        responses={409: OpenApiTypes.OBJECT},
        tags=['employer-verification'],
    )
    def post(self, request):
        del request
        raise UploadPreviewScanRequiredResponse()


@extend_schema(
    summary='Tải nội dung giấy tờ pháp lý đã nộp',
    responses={(200, 'application/octet-stream'): OpenApiTypes.BINARY},
    tags=['employer-verification'],
)
class CompanyDocumentContentView(generics.GenericAPIView):
    """Authorized private-file download for the employer's own documents."""

    permission_classes = [IsEmployer]

    def get(self, request, pk):
        recruiter = existing_recruiter_profile(request.user)
        if recruiter is None:
            raise Http404
        document = (
            employer_document_content_queryset(
                user=request.user,
                recruiter=recruiter,
            )
            .filter(pk=pk)
            .first()
        )
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

    Mỗi requester có tối đa một yêu cầu pending trên một công ty. POST tiếp theo
    của cùng requester cập nhật chính record đó; request của thành viên khác
    luôn độc lập.
    """

    serializer_class = CompanyUpdateRequestSerializer
    permission_classes = [IsEmployer]
    pagination_class = None

    def get_recruiter(self):
        if not hasattr(self, '_recruiter'):
            self._recruiter = require_company_recruiter(self.request.user)
        return self._recruiter

    @extend_schema(
        summary='Lịch sử yêu cầu cập nhật công ty',
        responses={200: CompanyUpdateRequestSerializer(many=True)},
        tags=['employer'],
        parameters=[
            OpenApiParameter(
                'scope',
                OpenApiTypes.STR,
                OpenApiParameter.QUERY,
                enum=['mine', 'company'],
                description='mine: yêu cầu của tôi; company: lịch sử toàn công ty (mặc định).',
            )
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        scope = self.request.query_params.get('scope', 'company')
        if scope not in {'mine', 'company'}:
            raise ValidationError({'scope': 'Phạm vi phải là mine hoặc company.'})
        return company_update_requests_queryset(
            company=self.get_recruiter().company,
            requester=self.request.user if scope == 'mine' else None,
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['company'] = self.get_recruiter().company
        context['recruiter'] = self.get_recruiter()
        return context

    @extend_schema(
        summary='Gửi hoặc sửa yêu cầu cập nhật công ty đang mở của tôi',
        request=CompanyUpdateRequestSerializer,
        responses={201: CompanyUpdateRequestSerializer, 200: CompanyUpdateRequestSerializer},
        tags=['employer'],
    )
    def post(self, request, *args, **kwargs):
        recruiter = self.get_recruiter()

        def validate(company, active_request):
            serializer = self.get_serializer(
                active_request,
                data=request.data,
                # Page content fields need the page policy (ER-D59).
                context={
                    **self.get_serializer_context(),
                    'page_access': resolve_company_page_access(recruiter),
                },
            )
            serializer.is_valid(raise_exception=True)
            return serializer.validated_data

        try:
            update_request, created = submit_validated_company_update(
                company_id=recruiter.company_id,
                requester=request.user,
                validate=validate,
            )
        except CompanyUpdateInReview as error:
            raise ValidationError(COMPANY_UPDATE_IN_REVIEW) from error
        except CompanyUpdateConflict as error:
            raise CompanyUpdateConflictResponse(error.fields) from error
        return Response(
            self.get_serializer(update_request).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CompanyUpdateRequestLifecycleView(generics.GenericAPIView):
    permission_classes = [IsEmployer]
    serializer_class = CompanyUpdateRequestCloseSerializer

    @extend_schema(
        operation_id='employer_company_update_request_lifecycle',
        summary='Rút hoặc hủy yêu cầu cập nhật công ty trước khi thẩm định',
        request=CompanyUpdateRequestCloseSerializer,
        responses={200: CompanyUpdateRequestSerializer},
    )
    def post(self, request, public_id, action):
        recruiter = require_company_recruiter(request.user)
        update_request = company_update_request_for_company(
            company=recruiter.company,
            public_id=public_id,
        )
        if update_request is None:
            raise Http404
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_status = {
            'withdraw': CompanyUpdateRequest.Status.WITHDRAWN,
            'cancel': CompanyUpdateRequest.Status.CANCELLED,
        }.get(action)
        if action_status is None:
            raise Http404
        try:
            update_request = close_company_update_before_review(
                update_request,
                actor=request.user,
                action=action_status,
                reason=serializer.validated_data.get('reason', ''),
                lock_version=serializer.validated_data['lock_version'],
                actor_is_owner=(recruiter.company_role == recruiter.CompanyRole.OWNER),
            )
        except CompanyUpdateConflict as error:
            raise CompanyUpdateConflictResponse(error.fields) from error
        return Response(
            CompanyUpdateRequestSerializer(
                update_request,
                context={
                    **self.get_serializer_context(),
                    'company': recruiter.company,
                    'recruiter': recruiter,
                },
            ).data
        )
