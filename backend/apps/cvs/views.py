from uuid import uuid4

from django.core.files.storage import default_storage
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate
from apps.common.media_storage import media_public_url

from .models import UserCv
from .serializers import UserCvSerializer

ALLOWED_UPLOAD_TYPES = {'pdf', 'docx'}


class UserCvListCreateView(generics.ListCreateAPIView):
    serializer_class = UserCvSerializer
    permission_classes = [IsCandidate]

    def get_queryset(self):
        return UserCv.objects.filter(user=self.request.user, is_deleted=False)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, cv_type=UserCv.CvType.BUILDER, source=UserCv.Source.BUILDER)


class UserCvDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserCvSerializer
    permission_classes = [IsCandidate]
    lookup_field = 'public_id'

    def get_queryset(self):
        return UserCv.objects.filter(user=self.request.user, is_deleted=False)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['is_deleted', 'deleted_at'])


class UserCvUploadView(APIView):
    permission_classes = [IsCandidate]
    parser_classes = [parsers.MultiPartParser]

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

        file_type = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
        if file_type not in ALLOWED_UPLOAD_TYPES:
            return Response({'file': 'Only PDF or DOCX files are supported.'}, status=status.HTTP_400_BAD_REQUEST)

        path = default_storage.save(f'cvs/uploads/{request.user.public_id}/{uuid4().hex}.{file_type}', upload)
        file_url = media_public_url(path, request=request)

        cv = UserCv.objects.create(
            user=request.user,
            cv_type=UserCv.CvType.UPLOADED,
            source=UserCv.Source.UPLOADED,
            title=request.data.get('title') or upload.name,
            file_url=file_url,
            file_name=upload.name,
            file_type=file_type,
            status=UserCv.Status.UPLOADED,
        )
        return Response(UserCvSerializer(cv).data, status=status.HTTP_201_CREATED)
