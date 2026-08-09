import hashlib
from pathlib import PurePosixPath
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import parsers, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.r2_storage import private_media_storage

from ...models import Company, CompanyDocument, RecruiterProfile
from ...selectors import has_explicit_company_link
from ...services import (
    get_or_create_recruiter,
    get_or_create_verification_case,
    lock_company_update_request,
    record_verification_upload,
)
from ..serializers import RecruiterProfileSerializer

DOCUMENT_SIGNATURES = {
    'jpg': (b'\xff\xd8\xff', {'image/jpeg'}),
    'png': (b'\x89PNG\r\n\x1a\n', {'image/png'}),
    'pdf': (b'%PDF-', {'application/pdf'}),
    'doc': (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1', {'application/msword'}),
    'docx': (
        b'PK\x03\x04',
        {'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
    ),
}

VERIFICATION_METHOD_DOCUMENT_TYPES = {
    'business_registration': {CompanyDocument.DocType.BUSINESS_REGISTRATION},
    'authorization_and_id': {
        CompanyDocument.DocType.AUTHORIZATION_LETTER,
        CompanyDocument.DocType.IDENTITY_DOCUMENT,
    },
}
VERIFICATION_DOCUMENT_TYPES = frozenset().union(*VERIFICATION_METHOD_DOCUMENT_TYPES.values())


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

    header = upload.read(16)
    upload.seek(0)
    extension = next(
        (
            key
            for key, (signature, content_types) in DOCUMENT_SIGNATURES.items()
            if key in _allowed_extensions(doc_type)
            and header.startswith(signature)
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
    upload,
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
        or update_request.status != update_request.Status.PENDING
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

    digest = hashlib.sha256()
    for chunk in upload.chunks():
        digest.update(chunk)
    upload.seek(0)
    path = _save_document_file(
        upload,
        directory,
        doc_type,
    )
    document_name = (
        'Thỏa thuận xử lý DLCN'
        if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
        else upload.name
    )

    document = CompanyDocument.objects.create(
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
        mime_type=upload.content_type or '',
        file_size=upload.size,
        sha256=digest.hexdigest(),
    )
    if verification_case is not None:
        record_verification_upload(
            recruiter=recruiter,
            document=document,
            verification_method=verification_method,
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
    """Liên kết một lần với công ty có sẵn, có hiệu lực ngay.

    Đây chỉ là gán HR vào công ty, không phải yêu cầu xác thực hay yêu cầu
    chỉnh sửa công ty. Hai nghiệp vụ sau có workflow duyệt riêng.
    """

    # Liên kết không yêu cầu MFA/xác thực lại và không nhận giấy tờ.
    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser]

    @extend_schema(
        summary='Liên kết ngay với công ty có sẵn',
        request=inline_serializer(
            'JoinCompany',
            fields={
                'company': serializers.CharField(help_text='public_id công ty'),
            },
        ),
        responses={200: RecruiterProfileSerializer},
        tags=['employer'],
    )
    @transaction.atomic
    def post(self, request):
        get_or_create_recruiter(request.user)
        recruiter = RecruiterProfile.objects.select_for_update().get(user=request.user)
        if has_explicit_company_link(recruiter):
            raise ValidationError(
                {'detail': 'Bạn đã liên kết với một công ty — không thể đổi công ty khác.'}
            )

        company = Company.objects.filter(public_id=request.data.get('company')).first()
        if company is None:
            raise ValidationError({'company': 'Không tìm thấy công ty.'})
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

        recruiter.company = company
        recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        recruiter.save(update_fields=['company', 'company_role', 'updated_at'])
        return Response(RecruiterProfileSerializer(recruiter, context={'request': request}).data)
