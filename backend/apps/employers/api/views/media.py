from django.conf import settings
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from common.storage.media import validate_image_upload

from ...models import CompanyImage
from ...selectors import (
    company_changes_require_update_request,
    requester_editable_company_update_request,
)
from ...services import delete_company_gallery_image, remove_company_image, save_company_image
from ..exceptions import UploadSessionRequiredResponse
from ..permissions import require_company_media_editor
from ..serializers import CompanyImageSerializer, CompanySerializer


def _media_update_request(request, company):
    """The update request named by the client; required once approval applies."""
    update_request_id = request.data.get('update_request') or request.query_params.get(
        'update_request'
    )
    if not update_request_id:
        if company_changes_require_update_request(company):
            raise ValidationError(
                {
                    'update_request': (
                        'Mọi thay đổi ảnh sau khi nộp hồ sơ công ty phải thuộc một yêu cầu '
                        'cập nhật chờ duyệt.'
                    )
                }
            )
        return None
    update_request = requester_editable_company_update_request(
        company=company,
        requester=request.user,
        public_id=update_request_id,
    )
    if update_request is None:
        raise ValidationError({'update_request': 'Không tìm thấy yêu cầu cập nhật đang chờ.'})
    return update_request


def _media_response(request, company, update_request):
    if update_request is not None:
        return Response(
            {
                'update_request': update_request.public_id,
                'lock_version': update_request.lock_version,
            }
        )
    return Response(CompanySerializer(company, context={'request': request}).data)


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

        company = require_company_media_editor(request.user).company
        company, update_request = save_company_image(
            user=request.user,
            company=company,
            kind=self.kind,
            update_request=_media_update_request(request, company),
            upload=upload,
            upload_session_public_id=upload_session_public_id,
        )
        return _media_response(request, company, update_request)

    @extend_schema(
        summary='Xóa logo hoặc ảnh bìa công ty',
        request=None,
        responses={200: CompanySerializer},
        tags=['employer'],
    )
    def delete(self, request):
        if self.kind == 'gallery':
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        company = require_company_media_editor(request.user).company
        company, update_request = remove_company_image(
            user=request.user,
            company=company,
            kind=self.kind,
            update_request=_media_update_request(request, company),
        )
        return _media_response(request, company, update_request)


class CompanyLogoUploadView(CompanyImageUploadView):
    kind = 'logo'


class CompanyCoverUploadView(CompanyImageUploadView):
    kind = 'cover'


class CompanyGalleryUploadView(CompanyImageUploadView):
    kind = 'gallery'

    @extend_schema(exclude=True)
    def delete(self, request):
        return super().delete(request)


@extend_schema_view(
    delete=extend_schema(
        summary='Xóa ảnh khỏi thư viện công ty trước khi nộp hồ sơ công ty',
        responses={204: None},
        tags=['employer'],
    )
)
class CompanyGalleryDeleteView(generics.DestroyAPIView):
    serializer_class = CompanyImageSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return CompanyImage.objects.filter(
            company=require_company_media_editor(self.request.user).company
        )

    def perform_destroy(self, instance):
        if company_changes_require_update_request(instance.company):
            raise ValidationError(
                {
                    'update_request': (
                        'Xóa ảnh sau khi nộp hồ sơ công ty phải được gửi trong yêu cầu cập nhật.'
                    )
                }
            )
        delete_company_gallery_image(instance)
