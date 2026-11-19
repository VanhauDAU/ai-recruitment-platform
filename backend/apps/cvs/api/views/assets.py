"""CV media: candidate avatar upload and token-guarded asset content."""

from django.conf import settings
from django.http import FileResponse, Http404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import parsers, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate
from apps.cvs.api.exceptions import (
    CandidateUploadSessionRequiredResponse,
    CandidateUploadSessionResponse,
)
from apps.cvs.api.serializers import CvAssetSerializer, CvAssetUploadSerializer
from apps.cvs.models import CvAsset
from apps.cvs.services import create_avatar_asset, create_avatar_asset_from_session, readable_asset
from apps.uploads.services import UploadServiceError


class CvAssetUploadView(APIView):
    permission_classes = [IsCandidate]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    @extend_schema(
        summary='Tải ảnh đại diện dùng trong CV',
        request=CvAssetUploadSerializer,
        responses={201: CvAssetSerializer},
        tags=['cvs'],
    )
    def post(self, request):
        serializer = CvAssetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data.get('file')
        upload_session_public_id = serializer.validated_data.get('upload_session', '')
        if upload and settings.CANDIDATE_UPLOAD_SESSION_REQUIRED:
            raise CandidateUploadSessionRequiredResponse()
        try:
            if upload_session_public_id:
                asset = create_avatar_asset_from_session(
                    actor=request.user,
                    upload_session_public_id=upload_session_public_id,
                )
            else:
                asset = create_avatar_asset(actor=request.user, upload=upload)
        except UploadServiceError as error:
            raise CandidateUploadSessionResponse(error) from error
        return Response(
            CvAssetSerializer(asset, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class CvAssetContentView(APIView):
    # Public on purpose: catalogue backgrounds are public, and an avatar is read by
    # its owner's session or by a signed token (recruiters, share links, PDF worker).
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary='Nội dung nhị phân của asset CV',
        parameters=[OpenApiParameter('token', str, description='Token truy cập tạm thời')],
        responses={(200, 'application/octet-stream'): OpenApiTypes.BINARY},
        tags=['cvs'],
    )
    def get(self, request, asset_public_id):
        try:
            asset = readable_asset(
                asset_public_id=asset_public_id,
                token=request.query_params.get('token'),
                user=request.user,
            )
        except CvAsset.DoesNotExist as error:
            raise Http404 from error
        try:
            stream = asset.storage().open(asset.storage_key, 'rb')
        except OSError as error:
            raise Http404 from error
        return FileResponse(stream, content_type=asset.content_type)
