from django.db.models import Max
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployerWithMFA
from common.media_storage import delete_local_media_url, save_image_upload, validate_image_upload

from ...models import CompanyImage
from ..serializers import CompanyImageSerializer, CompanySerializer
from .onboarding import _require_owner


class CompanyImageUploadView(APIView):
    """Upload ảnh cho công ty: logo, cover hoặc ảnh giới thiệu (`kind`)."""

    permission_classes = [IsEmployerWithMFA]
    parser_classes = [parsers.MultiPartParser]
    kind = ''  # 'logo' | 'cover' | 'gallery'

    @extend_schema(
        summary='Upload ảnh công ty vào storage nội bộ',
        request=inline_serializer(
            'CompanyImageUploadRequest',
            fields={
                'file': serializers.FileField(help_text='Ảnh JPG, PNG, GIF hoặc WebP, tối đa 5MB')
            },
        ),
        responses={200: CompanySerializer},
        tags=['employer'],
    )
    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'file': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        extension, _ = validate_image_upload(upload)
        if extension == 'gif':
            return Response(
                {'file': 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = _require_owner(request.user).company
        if self.kind == 'gallery' and company.images.count() >= 10:
            return Response(
                {'file': 'Thư viện công ty chỉ được có tối đa 10 ảnh.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        saved = save_image_upload(
            upload,
            f'employers/{company.public_id}/{self.kind}s',
            request=request,
            max_dimensions=(2400, 1600),
        )

        try:
            if self.kind == 'gallery':
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
            delete_local_media_url(saved['path'])
            raise

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
        field = 'logo_url' if self.kind == 'logo' else 'cover_image_url'
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
    permission_classes = [IsEmployerWithMFA]

    def get_queryset(self):
        return CompanyImage.objects.filter(company=_require_owner(self.request.user).company)

    def perform_destroy(self, instance):
        delete_local_media_url(instance.image_url)
        instance.delete()
