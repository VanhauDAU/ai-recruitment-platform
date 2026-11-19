"""Admin shared library (categories, colors, backgrounds) and the CV overview page."""

from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import (
    admin_backgrounds_queryset,
    admin_categories_queryset,
    admin_colors_queryset,
    cv_admin_overview,
)
from ...services import create_background_asset, delete_library_item
from ..serializers.admin_library import (
    CvBackgroundAdminSerializer,
    CvCategoryAdminSerializer,
    CvColorAdminSerializer,
)
from .admin_base import ADMIN_TAGS, AdminModelViewSet


class LibraryItemViewSet(AdminModelViewSet):
    """Danh mục/màu đang được mẫu CV dùng thì không xóa được (CVT-4)."""

    lookup_field = 'public_id'

    def perform_destroy(self, instance):
        delete_library_item(instance)


@extend_schema(tags=ADMIN_TAGS)
class AdminCvCategoryViewSet(LibraryItemViewSet):
    serializer_class = CvCategoryAdminSerializer

    def get_queryset(self):
        return admin_categories_queryset()


@extend_schema(tags=ADMIN_TAGS)
class AdminCvColorViewSet(LibraryItemViewSet):
    serializer_class = CvColorAdminSerializer

    def get_queryset(self):
        return admin_colors_queryset()


@extend_schema(tags=ADMIN_TAGS)
class AdminCvBackgroundViewSet(AdminModelViewSet):
    serializer_class = CvBackgroundAdminSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_backgrounds_queryset()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data.get('file')
        if upload is None:
            raise ValidationError({'file': 'This field is required.'})
        asset = create_background_asset(
            upload=upload,
            title=serializer.validated_data.get('title', ''),
        )
        return Response(
            self.get_serializer(asset).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        asset = self.get_object()
        allowed = {key: request.data[key] for key in ('title', 'is_active') if key in request.data}
        serializer = self.get_serializer(asset, data=allowed, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        # Xóa ảnh nền chỉ ẩn nó khỏi thư viện; tệp và bản ghi được giữ.
        self.get_object().deactivate()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary='Số liệu và việc cần làm của trang Tổng quan Mẫu CV',
    responses={200: OpenApiTypes.OBJECT},
    tags=ADMIN_TAGS,
)
class AdminCvOverviewView(APIView):
    """Số liệu và việc cần làm của trang Tổng quan Mẫu CV."""

    permission_classes = [AdminPortalPermission]

    def get(self, request):
        return Response(cv_admin_overview())
