from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, permissions, serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.media_storage import delete_local_media_url, save_image_upload

from .models import EmployerProfile, Industry
from .serializers import EmployerProfileSerializer, IndustrySerializer


class MyEmployerProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = EmployerProfileSerializer
    permission_classes = [IsEmployer]

    def get_object(self):
        try:
            return EmployerProfile.objects.get(user=self.request.user)
        except EmployerProfile.DoesNotExist:
            raise NotFound('Employer profile not created yet. Use POST to create it.')


class CreateEmployerProfileView(generics.CreateAPIView):
    serializer_class = EmployerProfileSerializer
    permission_classes = [IsEmployer]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class EmployerProfileImageUploadView(APIView):
    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser]
    field_name = ''
    media_directory = ''

    def get_profile(self):
        try:
            return EmployerProfile.objects.get(user=self.request.user)
        except EmployerProfile.DoesNotExist:
            raise NotFound('Employer profile not created yet. Use POST to create it.')

    @extend_schema(
        summary='Upload ảnh hồ sơ công ty vào storage nội bộ',
        request=inline_serializer(
            'EmployerProfileImageUploadRequest',
            fields={'file': serializers.FileField(help_text='Ảnh JPG, PNG, GIF hoặc WebP, tối đa 5MB')},
        ),
        responses={200: EmployerProfileSerializer},
        tags=['employer'],
    )
    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'file': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        profile = self.get_profile()
        old_url = getattr(profile, self.field_name)
        saved = save_image_upload(upload, f'employers/{profile.public_id}/{self.media_directory}', request=request)

        # Lưu key của storage thay vì URL tuyệt đối phụ thuộc localhost/domain.
        setattr(profile, self.field_name, saved['path'])
        profile.save(update_fields=[self.field_name, 'updated_at'])
        delete_local_media_url(old_url)

        return Response(EmployerProfileSerializer(profile).data)


class EmployerLogoUploadView(EmployerProfileImageUploadView):
    field_name = 'company_logo_url'
    media_directory = 'logos'


class EmployerCoverUploadView(EmployerProfileImageUploadView):
    field_name = 'cover_image_url'
    media_directory = 'covers'


class IndustryListView(generics.ListAPIView):
    """Danh sách lĩnh vực công ty cho bộ lọc "Lĩnh vực công ty" (chỉ những lĩnh vực đang có công ty)."""

    serializer_class = IndustrySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = Industry.objects.filter(employers__isnull=False).distinct()
