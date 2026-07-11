from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.media_storage import delete_local_media_url, save_image_upload

from ...models import CompanyImage
from ..serializers import CompanyImageSerializer, CompanySerializer
from .onboarding import _require_owner


class CompanyImageUploadView(APIView):
    """Upload ảnh cho công ty: logo, cover hoặc ảnh giới thiệu (`kind`)."""

    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser]
    kind = ''  # 'logo' | 'cover' | 'gallery'

    @extend_schema(
        summary='Upload ảnh công ty vào storage nội bộ',
        request=inline_serializer(
            'CompanyImageUploadRequest',
            fields={'file': serializers.FileField(help_text='Ảnh JPG, PNG, GIF hoặc WebP, tối đa 5MB')},
        ),
        responses={200: CompanySerializer},
        tags=['employer'],
    )
    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'file': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        company = _require_owner(request.user).company
        saved = save_image_upload(upload, f'employers/{company.public_id}/{self.kind}s', request=request)

        if self.kind == 'gallery':
            CompanyImage.objects.create(company=company, image_url=saved['path'])
        else:
            field = 'logo_url' if self.kind == 'logo' else 'cover_image_url'
            delete_local_media_url(getattr(company, field))
            # Lưu key của storage thay vì URL tuyệt đối phụ thuộc localhost/domain.
            setattr(company, field, saved['path'])
            company.save(update_fields=[field, 'updated_at'])

        return Response(CompanySerializer(company, context={'request': request}).data)


class CompanyLogoUploadView(CompanyImageUploadView):
    kind = 'logo'


class CompanyCoverUploadView(CompanyImageUploadView):
    kind = 'cover'


class CompanyGalleryUploadView(CompanyImageUploadView):
    kind = 'gallery'


class CompanyGalleryDeleteView(generics.DestroyAPIView):
    serializer_class = CompanyImageSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return CompanyImage.objects.filter(company=_require_owner(self.request.user).company)

    def perform_destroy(self, instance):
        delete_local_media_url(instance.image_url)
        instance.delete()

