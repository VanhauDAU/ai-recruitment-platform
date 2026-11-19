"""Admin library of images embedded in knowledgebase articles."""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import (
    admin_media_queryset,
)
from ...services import (
    upload_knowledge_media,
)
from ..serializers import (
    MediaSerializer,
    MediaUploadSerializer,
)
from .admin_shared import (
    ERROR_RESPONSES,
    PrivateNoStoreMixin,
)


@extend_schema(tags=['knowledgebase-admin'])
class AdminMediaListCreateView(PrivateNoStoreMixin, generics.ListAPIView):
    permission_classes = [AdminPortalPermission]
    serializer_class = MediaSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return admin_media_queryset(self.request.query_params.get('q', '').strip())

    @extend_schema(
        request=MediaUploadSerializer,
        responses={201: MediaSerializer, 413: OpenApiResponse(), **ERROR_RESPONSES},
    )
    def post(self, request):
        serializer = MediaUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        asset = upload_knowledge_media(
            upload=serializer.validated_data['file'],
            actor=request.user,
            default_alt_text=serializer.validated_data.get('default_alt_text', ''),
            request=request,
        )
        return Response(
            MediaSerializer(asset, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )
