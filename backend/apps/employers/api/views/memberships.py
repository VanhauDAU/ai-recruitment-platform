import hashlib
from pathlib import PurePosixPath
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.uploads.services import UploadServiceError, claim_clean_upload
from common.file_signatures import PDF_SIGNATURE, SIGNATURE_WINDOW_BYTES, has_pdf_header
from common.public_id import generate_public_id
from common.r2_storage import private_media_storage

from ...models import CompanyDocument
from ...selectors import (
    company_join_requests_for_owner,
    pending_company_join_request,
)
from ...services import (
    REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES,
    EmployerUploadStructureError,
    cancel_company_join,
    company_owners,
    decide_company_join,
    get_or_create_recruiter,
    get_or_create_verification_case,
    lock_company_update_request,
    record_verification_upload,
    request_company_join,
    snapshot_company_update_request,
    transfer_company_ownership,
    validate_employer_upload_structure,
)
from ..exceptions import EmployerUploadSessionResponse
from ..serializers.join_requests import CompanyJoinRequestSerializer

DOCUMENT_SIGNATURES = {
    'jpg': (b'\xff\xd8\xff', {'image/jpeg'}),
    'png': (b'\x89PNG\r\n\x1a\n', {'image/png'}),
    'pdf': (PDF_SIGNATURE, {'application/pdf'}),
    'doc': (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1', {'application/msword'}),
    'docx': (
        b'PK\x03\x04',
        {'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
    ),
}

DOCUMENT_CONTENT_TYPES = {
    CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT: {
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
}
DEFAULT_DOCUMENT_CONTENT_TYPES = {'application/pdf', 'image/jpeg', 'image/png'}
EMPLOYER_DOCUMENT_CLAIM_SCOPE = 'employer_document'

VERIFICATION_METHOD_DOCUMENT_TYPES = {
    'business_registration': {CompanyDocument.DocType.BUSINESS_REGISTRATION},
    'authorization_and_id': {
        CompanyDocument.DocType.AUTHORIZATION_LETTER,
        CompanyDocument.DocType.IDENTITY_DOCUMENT,
    },
}
VERIFICATION_DOCUMENT_TYPES = frozenset().union(*VERIFICATION_METHOD_DOCUMENT_TYPES.values())


def _matches_signature(extension, header, signature):
    if extension == 'pdf':
        return has_pdf_header(header)
    return header.startswith(signature)


def _allowed_extensions(doc_type):
    if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT:
        return {'pdf', 'doc', 'docx'}
    return {'jpg', 'png', 'pdf'}


def _delete_private_document_files(paths):
    for path in paths:
        private_media_storage().delete(path)


def _save_document_file(upload, directory, doc_type):
    max_size = getattr(settings, 'IMAGE_UPLOAD_MAX_SIZE', 5 * 1024 * 1024)
    if upload.size > max_size:
        raise ValidationError({'file': 'Giấy tờ phải nhỏ hơn 5 MB.'})

    header = upload.read(SIGNATURE_WINDOW_BYTES)
    upload.seek(0)
    extension = next(
        (
            key
            for key, (signature, content_types) in DOCUMENT_SIGNATURES.items()
            if key in _allowed_extensions(doc_type)
            and _matches_signature(key, header, signature)
            and upload.content_type in content_types
        ),
        None,
    )
    if extension is None:
        allowed = (
            'PDF, DOC hoặc DOCX'
            if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
            else 'JPG, PNG hoặc PDF'
        )
        raise ValidationError({'file': f'Chỉ chấp nhận tệp {allowed} hợp lệ.'})

    safe_directory = str(PurePosixPath(directory.strip('/')))
    path = private_media_storage().save(f'{safe_directory}/{uuid4().hex}.{extension}', upload)
    return path


@transaction.atomic
def _save_document(
    request,
    company,
    doc_type,
    upload=None,
    upload_session_public_id='',
    update_request=None,
    recruiter=None,
    verification_method='',
    append_to_current_set=False,
    replace_document_public_id='',
):
    recruiter = recruiter or get_or_create_recruiter(request.user)
    if update_request is not None and company is not None:
        company, update_request = lock_company_update_request(
            company_id=company.pk,
            update_request_id=update_request.pk,
        )
    if update_request is not None and (
        update_request.requested_by_id != request.user.id
        or company is None
        or update_request.company_id != company.id
        or update_request.status not in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES
    ):
        raise ValidationError({'update_request': 'Không tìm thấy yêu cầu cập nhật đang chờ.'})
    if company is None and recruiter.company_id:
        company = recruiter.company
    if company is not None:
        directory = f'employers/{company.public_id}/documents'
    elif doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT and recruiter is not None:
        directory = f'employers/{recruiter.public_id}/documents'
    else:
        raise ValidationError({'detail': 'Không xác định được chủ sở hữu của giấy tờ.'})

    verification_case = None
    existing = None
    document_scope = None
    if update_request is not None:
        document_scope = CompanyDocument.objects.select_for_update().filter(
            update_request=update_request,
            doc_type=doc_type,
            is_current=True,
        )
    elif doc_type in VERIFICATION_DOCUMENT_TYPES | {
        CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
    }:
        verification_case = get_or_create_verification_case(recruiter)
        document_scope = CompanyDocument.objects.select_for_update().filter(
            verification_case=verification_case,
            doc_type=doc_type,
            is_current=True,
        )

    if document_scope is not None:
        if replace_document_public_id:
            existing = document_scope.filter(public_id=replace_document_public_id).first()
            if existing is None:
                raise ValidationError({'replaces': 'Không tìm thấy tệp hiện hành cần thay thế.'})
            existing.is_current = False
            existing.save(update_fields=['is_current', 'updated_at'])
        elif append_to_current_set:
            if document_scope.count() >= 10:
                raise ValidationError({'file': 'Mỗi loại giấy tờ được tải tối đa 10 tệp.'})
            existing = None
        else:
            existing = document_scope.order_by('-version', '-created_at', '-id').first()
            if existing is not None:
                document_scope.update(is_current=False)

    version_scope = CompanyDocument.objects.filter(doc_type=doc_type)
    if update_request is not None:
        version_scope = version_scope.filter(update_request=update_request)
    elif verification_case is not None:
        version_scope = version_scope.filter(verification_case=verification_case)
    else:
        version_scope = version_scope.filter(
            company=company,
            recruiter=recruiter,
            update_request__isnull=True,
            verification_case__isnull=True,
        )
    latest_version = (
        version_scope.order_by('-version', '-created_at', '-id')
        .values_list('version', flat=True)
        .first()
        or 0
    )

    upload_asset = None
    document_public_id = generate_public_id('doc')
    if upload_session_public_id:
        expected_purpose = (
            'employer_company_update' if update_request is not None else 'employer_verification'
        )
        try:
            upload_asset = claim_clean_upload(
                owner=request.user,
                public_id=upload_session_public_id,
                expected_purpose=expected_purpose,
                claim_scope=EMPLOYER_DOCUMENT_CLAIM_SCOPE,
                claim_reference=document_public_id,
            )
        except UploadServiceError as error:
            raise EmployerUploadSessionResponse(error) from error
        max_size = getattr(settings, 'IMAGE_UPLOAD_MAX_SIZE', 5 * 1024 * 1024)
        if upload_asset.size_bytes > max_size:
            raise ValidationError({'upload_session': 'Giấy tờ phải nhỏ hơn 5 MB.'})
        allowed_content_types = DOCUMENT_CONTENT_TYPES.get(
            doc_type,
            DEFAULT_DOCUMENT_CONTENT_TYPES,
        )
        if upload_asset.content_type not in allowed_content_types:
            allowed = (
                'PDF hoặc DOCX'
                if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
                else 'JPG, PNG hoặc PDF'
            )
            raise ValidationError(
                {'upload_session': f'Chỉ chấp nhận tệp {allowed} đã quét an toàn.'}
            )
        try:
            validate_employer_upload_structure(upload_asset)
        except EmployerUploadStructureError as error:
            raise ValidationError(
                {'upload_session': 'Nội dung tệp bị lỗi hoặc không đúng định dạng khai báo.'}
            ) from error
        path = upload_asset.storage_key
        mime_type = upload_asset.content_type
        file_size = upload_asset.size_bytes
        checksum = upload_asset.checksum_sha256
        original_name = upload_asset.original_filename
    else:
        digest = hashlib.sha256()
        for chunk in upload.chunks():
            digest.update(chunk)
        upload.seek(0)
        path = _save_document_file(
            upload,
            directory,
            doc_type,
        )
        mime_type = upload.content_type or ''
        file_size = upload.size
        checksum = digest.hexdigest()
        original_name = upload.name
    document_name = (
        'Thỏa thuận xử lý DLCN'
        if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
        else original_name
    )

    document = CompanyDocument.objects.create(
        public_id=document_public_id,
        company=company,
        uploaded_by=request.user,
        update_request=update_request,
        recruiter=recruiter,
        verification_case=verification_case,
        supersedes=existing,
        version=latest_version + 1,
        doc_type=doc_type,
        file_url=path,
        file_name=document_name,
        mime_type=mime_type,
        file_size=file_size,
        sha256=checksum,
        upload_asset=upload_asset,
    )
    if verification_case is not None:
        record_verification_upload(
            recruiter=recruiter,
            document=document,
            verification_method=verification_method,
        )
    elif update_request is not None:
        snapshot_company_update_request(
            update_request,
            actor=request.user,
        )
    return document


def remove_obsolete_verification_documents(verification_case, verification_method):
    """Keep old proof files as audit history when a recruiter switches method."""
    current_doc_types = VERIFICATION_METHOD_DOCUMENT_TYPES[verification_method]
    (
        CompanyDocument.objects.filter(
            verification_case=verification_case,
            doc_type__in=VERIFICATION_DOCUMENT_TYPES - current_doc_types,
            update_request__isnull=True,
            is_current=True,
        ).update(is_current=False)
    )


class JoinCompanyView(APIView):
    """Xin tham gia một công ty có sẵn; chỉ có hiệu lực khi chủ công ty duyệt.

    Đây chỉ là gán HR vào công ty, không phải yêu cầu xác thực hay yêu cầu
    chỉnh sửa công ty. Hai nghiệp vụ sau có workflow duyệt riêng.
    """

    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser, parsers.JSONParser]

    @extend_schema(
        summary='Gửi yêu cầu tham gia công ty có sẵn',
        request=inline_serializer(
            'JoinCompany',
            fields={
                'company': serializers.CharField(help_text='public_id công ty'),
            },
        ),
        responses={202: CompanyJoinRequestSerializer},
        tags=['employer'],
    )
    def post(self, request):
        legacy_proof_fields = {
            'proof_type',
            'business_registration_file',
            'authorization_file',
            'identity_file',
        }
        if legacy_proof_fields.intersection(request.data) or legacy_proof_fields.intersection(
            request.FILES
        ):
            raise ValidationError(
                {
                    'detail': 'Tham gia công ty không yêu cầu hoặc nhận giấy tờ chứng minh. '
                    'Giấy tờ chỉ được nộp khi xác thực hoặc yêu cầu cập nhật công ty.'
                }
            )
        join_request = request_company_join(request.user, request.data.get('company'))
        return Response(
            CompanyJoinRequestSerializer(join_request).data, status=status.HTTP_202_ACCEPTED
        )


class MyCompanyJoinRequestView(APIView):
    """The caller's pending request: read it, or cancel it to pick another company."""

    permission_classes = [IsEmployer]

    @extend_schema(
        responses={200: CompanyJoinRequestSerializer(allow_null=True)}, tags=['employer']
    )
    def get(self, request):
        pending = pending_company_join_request(request.user)
        return Response(CompanyJoinRequestSerializer(pending).data if pending else None)

    @extend_schema(responses={204: None}, tags=['employer'])
    def delete(self, request):
        cancel_company_join(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompanyJoinRequestListView(generics.ListAPIView):
    """Pending requests to the company the caller owns."""

    permission_classes = [IsEmployer]
    serializer_class = CompanyJoinRequestSerializer
    pagination_class = None

    def get_queryset(self):
        return company_join_requests_for_owner(self.request.user)

    def get_serializer_context(self):
        recruiter = get_or_create_recruiter(self.request.user)
        can_decide = bool(
            recruiter.company_id
            and company_owners(recruiter.company).filter(user=self.request.user).exists()
        )
        return {**super().get_serializer_context(), 'can_decide': can_decide}


class CompanyJoinRequestDecisionView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(request=None, responses={200: CompanyJoinRequestSerializer}, tags=['employer'])
    def post(self, request, public_id, decision):
        if decision not in {'approve', 'reject'}:
            raise ValidationError({'decision': 'Chỉ chấp nhận approve hoặc reject.'})
        join_request = decide_company_join(request.user, public_id, approve=decision == 'approve')
        return Response(CompanyJoinRequestSerializer(join_request).data)


class CompanyOwnershipTransferView(APIView):
    """The verified owner hands the company to a verified member."""

    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Chuyển quyền owner công ty cho thành viên đã xác thực',
        request=inline_serializer(
            'CompanyOwnershipTransfer',
            fields={'recruiter': serializers.CharField(help_text='member_id của thành viên')},
        ),
        responses={204: None},
        tags=['employer'],
    )
    def post(self, request):
        transfer_company_ownership(request.user, request.data.get('recruiter', ''))
        return Response(status=status.HTTP_204_NO_CONTENT)
