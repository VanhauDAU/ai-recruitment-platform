from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import parsers, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.media_storage import save_image_upload

from ...models import Company, CompanyDocument, CompanyUpdateRequest, RecruiterProfile
from ...services import get_or_create_recruiter
from ..serializers import RecruiterProfileSerializer
from .onboarding import ALLOWED_DOCUMENT_TYPES


def _save_document(request, company, doc_type, upload, update_request=None):
    if upload.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise ValidationError({'file': 'Chỉ chấp nhận định dạng jpeg, jpg, png hoặc pdf.'})
    saved = save_image_upload(upload, f'employers/{company.public_id}/documents', request=request)
    return CompanyDocument.objects.create(
        company=company, uploaded_by=request.user, update_request=update_request,
        doc_type=doc_type, file_url=saved['path'], file_name=upload.name,
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
        if recruiter.company_id is not None:
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

