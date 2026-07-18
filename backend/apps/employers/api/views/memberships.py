from pathlib import PurePosixPath
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import default_storage
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import parsers, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from ...models import Company, CompanyDocument, CompanyUpdateRequest, RecruiterProfile
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
    extension = next((
        key for key, (signature, content_types) in DOCUMENT_SIGNATURES.items()
        if key in _allowed_extensions(doc_type)
        and header.startswith(signature)
        and upload.content_type in content_types
    ), None)
    if extension is None:
        allowed = 'PDF, DOC hoặc DOCX' if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT else 'JPG, PNG hoặc PDF'
        raise ValidationError({'file': f'Chỉ chấp nhận tệp {allowed} hợp lệ.'})

    safe_directory = str(PurePosixPath(directory.strip('/')))
    path = default_storage.save(f'{safe_directory}/{uuid4().hex}.{extension}', upload)
    return path


def _save_document(request, company, doc_type, upload, update_request=None):
    path = _save_document_file(
        upload,
        f'employers/{company.public_id}/documents',
        doc_type,
    )
    return CompanyDocument.objects.create(
        company=company, uploaded_by=request.user, update_request=update_request,
        doc_type=doc_type, file_url=path, file_name=upload.name,
    )


class JoinCompanyView(APIView):
    """Join công ty có sẵn: khóa lựa chọn, upload giấy tờ, membership chờ duyệt.

    Giấy tờ: `business_registration_file` HOẶC (`authorization_file` + `identity_file`).
    """

    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser]

    @extend_schema(
        summary='Join công ty có sẵn kèm giấy tờ chứng minh (chờ admin duyệt)',
        request=inline_serializer('JoinCompany', fields={
            'company': serializers.CharField(help_text='public_id công ty'),
            'proof_type': serializers.ChoiceField(choices=CompanyUpdateRequest.ProofType.choices),
            'business_registration_file': serializers.FileField(required=False),
            'authorization_file': serializers.FileField(required=False),
            'identity_file': serializers.FileField(required=False),
        }),
        responses={200: RecruiterProfileSerializer},
        tags=['employer'],
    )
    def post(self, request):
        recruiter = get_or_create_recruiter(request.user)
        if recruiter.phone_verified_at is None:
            raise ValidationError({'detail': 'Xác thực số điện thoại trước khi cập nhật thông tin công ty.'})
        if has_explicit_company_link(recruiter):
            raise ValidationError({'detail': 'Bạn đã liên kết với một công ty — không thể đổi công ty khác.'})

        company = Company.objects.filter(public_id=request.data.get('company')).first()
        if company is None:
            raise ValidationError({'company': 'Không tìm thấy công ty.'})

        proof_type = request.data.get('proof_type')
        if proof_type == CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION:
            upload = request.FILES.get('business_registration_file')
            if not upload:
                raise ValidationError({'business_registration_file': 'Upload giấy đăng ký doanh nghiệp hoặc giấy tờ tương đương.'})
            documents = [(CompanyDocument.DocType.BUSINESS_REGISTRATION, upload)]
        elif proof_type == CompanyUpdateRequest.ProofType.AUTHORIZATION_AND_ID:
            authorization = request.FILES.get('authorization_file')
            identity = request.FILES.get('identity_file')
            if not authorization or not identity:
                raise ValidationError({'detail': 'Upload đủ Giấy ủy quyền và Giấy tờ định danh (CCCD/hộ chiếu).'})
            documents = [
                (CompanyDocument.DocType.AUTHORIZATION_LETTER, authorization),
                (CompanyDocument.DocType.IDENTITY_DOCUMENT, identity),
            ]
        else:
            raise ValidationError({'proof_type': 'Chọn loại giấy tờ chứng minh.'})

        for doc_type, upload in documents:
            _save_document(request, company, doc_type, upload)

        recruiter.company = company
        recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        recruiter.membership_status = RecruiterProfile.MembershipStatus.PENDING
        recruiter.membership_proof_type = proof_type
        recruiter.save(update_fields=[
            'company', 'company_role', 'membership_status', 'membership_proof_type', 'updated_at',
        ])
        return Response(RecruiterProfileSerializer(recruiter, context={'request': request}).data)
