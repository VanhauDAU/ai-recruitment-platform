from django.conf import settings
from django.core.files.base import File
from django.db import transaction
from django.db.models import Max
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.uploads.services import UploadServiceError, claim_clean_upload
from common.media_storage import delete_local_media_url, save_image_upload, validate_image_upload
from common.public_id import generate_public_id
from common.r2_storage import private_media_storage

from ...models import Company, CompanyImage, CompanyMediaUpload, CompanyUpdateRequest
from ...services import (
    REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES,
    EmployerUploadStructureError,
    lock_company_update_request,
    snapshot_company_update_request,
    validate_employer_upload_structure,
)
from ..exceptions import EmployerUploadSessionResponse, UploadSessionRequiredResponse
from ..serializers import CompanyImageSerializer, CompanySerializer
from .onboarding import _require_owner

EMPLOYER_MEDIA_PURPOSE = 'employer_company_update'
EMPLOYER_MEDIA_CLAIM_SCOPE = 'employer_company_media'


def _approval_is_required(company):
    """Initial onboarding may upload media directly; later edits need a request."""
    return (
        company.verification_status != Company.VerificationStatus.UNVERIFIED
        or company.recruiter_verification_cases.exists()
        or company.update_requests.exists()
    )


def _get_update_request(request, company):
    update_request_id = request.data.get('update_request') or request.query_params.get(
        'update_request'
    )
    if not update_request_id:
        if _approval_is_required(company):
            raise ValidationError(
                {
                    'update_request': (
                        'Mọi thay đổi ảnh sau khi nộp hồ sơ công ty phải thuộc một yêu cầu '
                        'cập nhật chờ duyệt.'
                    )
                }
            )
        return None
    update_request = CompanyUpdateRequest.objects.filter(
        public_id=update_request_id,
        company=company,
        requested_by=request.user,
        status__in=REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES,
    ).first()
    if update_request is None:
        raise ValidationError({'update_request': 'Không tìm thấy yêu cầu cập nhật đang chờ.'})
    return update_request


def _save_scanned_image_derivative(*, request, company, update_request, kind, public_id):
    try:
        asset = claim_clean_upload(
            owner=request.user,
            public_id=public_id,
            expected_purpose=EMPLOYER_MEDIA_PURPOSE,
            claim_scope=EMPLOYER_MEDIA_CLAIM_SCOPE,
            claim_reference=generate_public_id('cma'),
        )
    except UploadServiceError as error:
        raise EmployerUploadSessionResponse(error) from error

    if asset.size_bytes > settings.IMAGE_UPLOAD_MAX_SIZE:
        raise ValidationError({'upload_session': 'Ảnh phải nhỏ hơn 5 MB.'})
    if asset.content_type not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise ValidationError({'upload_session': 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.'})
    try:
        validate_employer_upload_structure(asset)
    except EmployerUploadStructureError as error:
        raise ValidationError(
            {'upload_session': 'Nội dung ảnh bị lỗi hoặc không đúng định dạng khai báo.'}
        ) from error

    with private_media_storage().open(asset.storage_key, 'rb') as stored_file:
        upload = File(stored_file, name=asset.original_filename)
        upload.content_type = asset.content_type
        saved = save_image_upload(
            upload,
            f'employers/{company.public_id}/{kind}s',
            request=request,
            max_dimensions=(2400, 1600),
        )

    CompanyMediaUpload.objects.create(
        public_id=asset.claim_reference,
        company=company,
        uploaded_by=request.user,
        update_request=update_request,
        upload_asset=asset,
        kind=kind,
        public_path=saved['path'],
    )
    return saved


class CompanyImageUploadView(APIView):
    """Upload ảnh cho công ty: logo, cover hoặc ảnh giới thiệu (`kind`)."""

    permission_classes = [IsEmployer]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser]
    kind = ''  # 'logo' | 'cover' | 'gallery'

    @extend_schema(
        summary='Upload ảnh công ty vào storage nội bộ',
        request=inline_serializer(
            'CompanyImageUploadRequest',
            fields={
                'file': serializers.FileField(
                    required=False,
                    help_text='Ảnh JPG, PNG hoặc WebP, tối đa 5MB',
                ),
                'upload_session': serializers.CharField(required=False),
                'update_request': serializers.CharField(required=False),
            },
        ),
        responses={200: CompanySerializer},
        tags=['employer'],
    )
    def post(self, request):
        upload = request.FILES.get('file')
        upload_session_public_id = (request.data.get('upload_session') or '').strip()
        if not upload and not upload_session_public_id:
            raise ValidationError({'file': 'Vui lòng chọn ảnh.'})
        if upload and upload_session_public_id:
            raise ValidationError(
                {'upload_session': 'Không thể gửi đồng thời file thô và upload session.'}
            )
        if upload and settings.EMPLOYER_UPLOAD_SESSION_REQUIRED:
            raise UploadSessionRequiredResponse()
        if upload:
            extension, _ = validate_image_upload(upload)
            if extension == 'gif':
                raise ValidationError({'file': 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.'})

        company = _require_owner(request.user).company
        update_request = _get_update_request(request, company)
        if self.kind == 'gallery' and not update_request and company.images.count() >= 10:
            return Response(
                {'file': 'Thư viện công ty chỉ được có tối đa 10 ảnh.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        saved = None
        try:
            with transaction.atomic():
                if upload_session_public_id:
                    saved = _save_scanned_image_derivative(
                        request=request,
                        company=company,
                        update_request=update_request,
                        kind=self.kind,
                        public_id=upload_session_public_id,
                    )
                else:
                    saved = save_image_upload(
                        upload,
                        f'employers/{company.public_id}/{self.kind}s',
                        request=request,
                        max_dimensions=(2400, 1600),
                    )

                if update_request is not None:
                    company, update_request = lock_company_update_request(
                        company_id=company.pk,
                        update_request_id=update_request.pk,
                    )
                    if update_request.status not in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES:
                        raise ValidationError(
                            {'update_request': 'Yêu cầu cập nhật này vừa được xử lý.'}
                        )
                    changes = dict(update_request.changes)
                    replaced_path = ''
                    if self.kind == 'gallery':
                        additions = list(changes.get('gallery_additions', []))
                        deletions = set(changes.get('gallery_deletions', []))
                        final_count = (
                            company.images.exclude(id__in=deletions).count() + len(additions) + 1
                        )
                        if final_count > 10:
                            raise ValidationError(
                                {'file': 'Thư viện công ty chỉ được có tối đa 10 ảnh.'}
                            )
                        additions.append(saved['path'])
                        changes['gallery_additions'] = additions
                        changes.pop('gallery_pending', None)
                    elif self.kind == 'logo':
                        replaced_path = changes.get('logo_url', '')
                        changes['logo_url'] = saved['path']
                        changes['has_no_logo'] = False
                        changes.pop('logo_pending', None)
                    else:
                        replaced_path = changes.get('cover_image_url', '')
                        changes['cover_image_url'] = saved['path']
                        changes.pop('cover_pending', None)
                    update_request.changes = changes
                    update_request.save(update_fields=['changes', 'updated_at'])
                    snapshot_company_update_request(
                        update_request,
                        actor=request.user,
                    )
                    if replaced_path:
                        transaction.on_commit(lambda: delete_local_media_url(replaced_path))
                elif self.kind == 'gallery':
                    last_order = company.images.aggregate(value=Max('sort_order'))['value']
                    CompanyImage.objects.create(
                        company=company,
                        image_url=saved['path'],
                        sort_order=(last_order + 1) if last_order is not None else 0,
                    )
                else:
                    field = 'logo_url' if self.kind == 'logo' else 'cover_image_url'
                    delete_local_media_url(getattr(company, field))
                    # Lưu key của storage thay vì URL tuyệt đối phụ thuộc localhost/domain.
                    setattr(company, field, saved['path'])
                    update_fields = [field, 'updated_at']
                    if self.kind == 'logo':
                        company.has_no_logo = False
                        update_fields.append('has_no_logo')
                    company.save(update_fields=update_fields)
        except Exception:
            if saved:
                delete_local_media_url(saved['path'])
            raise

        if update_request is not None:
            return Response(
                {
                    'update_request': update_request.public_id,
                    'lock_version': update_request.lock_version,
                }
            )
        return Response(CompanySerializer(company, context={'request': request}).data)

    @extend_schema(
        summary='Xóa logo hoặc ảnh bìa công ty',
        request=None,
        responses={200: CompanySerializer},
        tags=['employer'],
    )
    def delete(self, request):
        if self.kind == 'gallery':
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        company = _require_owner(request.user).company
        update_request = _get_update_request(request, company)
        field = 'logo_url' if self.kind == 'logo' else 'cover_image_url'
        if update_request is not None:
            with transaction.atomic():
                company, update_request = lock_company_update_request(
                    company_id=company.pk,
                    update_request_id=update_request.pk,
                )
                if update_request.status not in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES:
                    raise ValidationError(
                        {'update_request': 'Yêu cầu cập nhật này vừa được xử lý.'}
                    )
                changes = dict(update_request.changes)
                staged_path = changes.pop(field, '')
                changes.pop(f'{self.kind}_pending', None)
                if self.kind == 'logo':
                    changes['has_no_logo'] = True
                else:
                    changes['cover_image_url'] = ''
                update_request.changes = changes
                update_request.save(update_fields=['changes', 'updated_at'])
                snapshot_company_update_request(
                    update_request,
                    actor=request.user,
                )
                if staged_path:
                    transaction.on_commit(lambda: delete_local_media_url(staged_path))
            return Response(
                {
                    'update_request': update_request.public_id,
                    'lock_version': update_request.lock_version,
                }
            )
        delete_local_media_url(getattr(company, field))
        setattr(company, field, '')
        update_fields = [field, 'updated_at']
        if self.kind == 'logo':
            company.has_no_logo = True
            update_fields.append('has_no_logo')
        company.save(update_fields=update_fields)
        return Response(CompanySerializer(company, context={'request': request}).data)


class CompanyLogoUploadView(CompanyImageUploadView):
    kind = 'logo'


class CompanyCoverUploadView(CompanyImageUploadView):
    kind = 'cover'


class CompanyGalleryUploadView(CompanyImageUploadView):
    kind = 'gallery'

    @extend_schema(exclude=True)
    def delete(self, request):
        return super().delete(request)


class CompanyGalleryDeleteView(generics.DestroyAPIView):
    serializer_class = CompanyImageSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return CompanyImage.objects.filter(company=_require_owner(self.request.user).company)

    def perform_destroy(self, instance):
        company = instance.company
        if _approval_is_required(company):
            raise ValidationError(
                {
                    'update_request': (
                        'Xóa ảnh sau khi nộp hồ sơ công ty phải được gửi trong yêu cầu cập nhật.'
                    )
                }
            )
        delete_local_media_url(instance.image_url)
        instance.delete()
