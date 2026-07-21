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
from ...services import get_or_create_recruiter
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


def _allowed_extensions(doc_type):
    if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT:
        return {'pdf', 'doc', 'docx'}
    return {'jpg', 'png', 'pdf'}


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


def _save_document(request, company, doc_type, upload, update_request=None, recruiter=None):
    if company is not None:
        directory = f'employers/{company.public_id}/documents'
    elif doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT and recruiter is not None:
        directory = f'employers/{recruiter.public_id}/documents'
    else:
        raise ValidationError({'detail': 'Không xác định được chủ sở hữu của giấy tờ.'})

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
    if recruiter is not None and doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT:
        existing = CompanyDocument.objects.filter(
            recruiter=recruiter,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        ).first()
        if existing is not None:
            previous_path = existing.file_url
            existing.file_url = path
            existing.file_name = document_name
            existing.uploaded_by = request.user
            existing.status = CompanyDocument.Status.PENDING
            existing.reviewed_by = None
            existing.reviewed_at = None
            existing.review_note = ''
            existing.save(
                update_fields=[
                    'file_url',
                    'file_name',
                    'uploaded_by',
                    'status',
                    'reviewed_by',
                    'reviewed_at',
                    'review_note',
                ]
            )
            if previous_path and previous_path != path:
                private_media_storage().delete(previous_path)
            return existing

    return CompanyDocument.objects.create(
        company=company,
        uploaded_by=request.user,
        update_request=update_request,
        recruiter=recruiter,
        doc_type=doc_type,
        file_url=path,
        file_name=document_name,
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
