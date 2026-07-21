from drf_spectacular.utils import extend_schema, inline_serializer
from django.http import FileResponse, Http404
from rest_framework import generics, parsers, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate
from common.api_deprecation import LegacyApiDeprecationMixin
from common.r2_storage import private_media_storage
from .models import UserCv
from .serializers import UserCvSerializer
from .selectors import candidate_cvs_queryset
from .services import UnsupportedCvUpload, create_builder_cv, permanently_delete_cv, update_builder_cv, upload_cv


class UserCvListCreateView(LegacyApiDeprecationMixin, generics.ListCreateAPIView):
    serializer_class = UserCvSerializer
    permission_classes = [IsCandidate]
    deprecation_contract = 'cvs-v1'
    deprecation_successor = '/api/v2/cvs/'

    def get_queryset(self):
        return candidate_cvs_queryset(self.request.user)

    def perform_create(self, serializer):
        create_builder_cv(serializer, self.request.user)


class UserCvDetailView(LegacyApiDeprecationMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserCvSerializer
    permission_classes = [IsCandidate]
    lookup_field = 'public_id'
    deprecation_contract = 'cvs-v1'
    deprecation_successor = '/api/v2/cvs/'

    def get_queryset(self):
        return candidate_cvs_queryset(self.request.user)

    def perform_destroy(self, instance):
        try:
            permanently_delete_cv(cv=instance, actor=self.request.user)
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error

    def perform_update(self, serializer):
        update_builder_cv(serializer, self.request.user)


class UserCvContentView(LegacyApiDeprecationMixin, APIView):
    """Compatibility download URL for legacy CV fields backed by private R2."""

    permission_classes = [IsCandidate]
    deprecation_contract = 'cvs-v1'
    deprecation_successor = '/api/v2/cvs/'
    _fields = {
        'file': ('file_url', None),
        'pdf': ('pdf_url', 'application/pdf'),
        'thumbnail': ('thumbnail_url', 'image/webp'),
    }

    def get(self, request, public_id, kind):
        field = self._fields.get(kind)
        if field is None:
            raise Http404
        try:
            cv = candidate_cvs_queryset(request.user).get(public_id=public_id)
        except UserCv.DoesNotExist as error:
            raise Http404 from error
        storage_key = getattr(cv, field[0])
        if not storage_key:
            raise Http404
        try:
            stream = private_media_storage().open(storage_key, 'rb')
        except OSError as error:
            raise Http404 from error
        return FileResponse(stream, content_type=field[1])


class UserCvUploadView(LegacyApiDeprecationMixin, APIView):
    permission_classes = [IsCandidate]
    parser_classes = [parsers.MultiPartParser]
    deprecation_contract = 'cvs-v1'
    deprecation_successor = '/api/v2/cvs/imports/'

    @extend_schema(
        summary='Upload CV có sẵn (PDF/DOCX)',
        request=inline_serializer(
            'UserCvUploadRequest',
            fields={
                'file': serializers.FileField(help_text='File CV định dạng PDF hoặc DOCX'),
                'title': serializers.CharField(required=False, help_text='Tên CV (mặc định lấy tên file)'),
            },
        ),
        responses={201: UserCvSerializer},
        tags=['cvs'],
    )
    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'file': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cv = upload_cv(request.user, upload, request.data.get('title', ''))
        except UnsupportedCvUpload as error:
            raise ValidationError({'file': str(error)}) from error
        return Response(UserCvSerializer(cv).data, status=status.HTTP_201_CREATED)
