import json
import re

from django.conf import settings
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission
from common.storage.media import media_url_from_value

from ...selectors import active_banners, resolved_link_groups, site_settings_by_group
from ...services import public_setting_values, submit_feedback, update_site_settings
from ..serializers import (
    AdminSiteSettingSerializer,
    BannerSerializer,
    FeedbackSerializer,
    LinkGroupSerializer,
)


@extend_schema(
    summary='Site settings công khai (đã resolve giá trị hiển thị)',
    responses={200: OpenApiTypes.OBJECT},
    tags=['site'],
)
class SiteSettingListView(APIView):
    """Trả về cấu hình công khai dạng {key: value} để frontend dùng trực tiếp.

    Cache 1h (LocMemCache); signal post_save/post_delete tự xoá khi admin sửa.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        response_data = {
            key: media_url_from_value(value, request=request) if is_image else value
            for key, (value, is_image) in public_setting_values().items()
        }
        # Capability vận hành phải theo backend kill switch, không phải một row
        # SiteSetting mà admin có thể vô tình bật lệch với public API/SEO shell.
        response_data['knowledgebase_public_enabled'] = bool(settings.KNOWLEDGEBASE_PUBLIC_ENABLED)
        response_data['knowledgebase_search_index_enabled'] = bool(
            settings.KNOWLEDGEBASE_PUBLIC_ENABLED and settings.KNOWLEDGEBASE_SEARCH_INDEX_ENABLED
        )
        return Response(response_data)


@extend_schema_view(
    get=extend_schema(summary='Admin: đọc toàn bộ site settings'),
    patch=extend_schema(summary='Admin: cập nhật site settings'),
)
@extend_schema(
    request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT}, tags=['site-admin']
)
class AdminSiteSettingView(APIView):
    """GET: toàn bộ cấu hình gộp theo 15 nhóm. PATCH: cập nhật hàng loạt value."""

    permission_classes = [AdminPortalPermission]
    require_superuser = True
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get(self, request):
        groups = [
            {
                'key': key,
                'label': label,
                'settings': AdminSiteSettingSerializer(
                    group_settings,
                    many=True,
                    context={'request': request},
                ).data,
            }
            for key, label, group_settings in site_settings_by_group()
        ]
        return Response({'groups': groups})

    def patch(self, request):
        values = request.data.get('values')
        if isinstance(values, str):
            try:
                values = json.loads(values)
            except json.JSONDecodeError:
                values = None
        if not isinstance(values, dict):
            raise ValidationError({'detail': 'Body phải có dạng {"values": {key: value}}.'})

        image_uploads = {}
        for field_name, upload in request.FILES.items():
            match = re.fullmatch(r'files\[(.+)]', field_name)
            image_uploads[match.group(1) if match else field_name] = upload

        result = update_site_settings(
            actor=request.user,
            values=values,
            image_uploads=image_uploads,
        )
        return Response(
            {
                'updated': result.updated,
                'errors': result.errors,
                'values': result.values,
                'display_values': {
                    key: media_url_from_value(result.values[key], request=request)
                    for key in result.image_keys
                },
            },
            status=(
                status.HTTP_400_BAD_REQUEST
                if result.errors and not result.updated
                else status.HTTP_200_OK
            ),
        )


@extend_schema(
    summary='Admin: tải ảnh cho một site setting',
    request=OpenApiTypes.OBJECT,
    responses={200: OpenApiTypes.OBJECT},
    tags=['site-admin'],
)
class AdminSettingUploadView(APIView):
    """Endpoint cũ: upload riêng từng ảnh.

    Luồng admin hiện dùng PATCH /admin/settings/ để lưu thủ công theo nút
    "Lưu thay đổi", nên endpoint này không còn ghi setting để tránh auto-save.
    """

    permission_classes = [AdminPortalPermission]
    require_superuser = True
    parser_classes = [MultiPartParser]

    def post(self, request):
        return Response(
            {
                'detail': 'Endpoint này đã ngưng dùng. Hãy gửi file cùng PATCH /api/admin/site/settings/ khi bấm lưu.'
            },
            status=status.HTTP_410_GONE,
        )


@extend_schema(summary='Cụm link đang bật (footer SEO...)', tags=['site'])
class LinkGroupListView(generics.ListAPIView):
    """Các cụm link đang bật, kèm items đã resolve. Lọc theo ?placement=footer_seo."""

    serializer_class = LinkGroupSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return resolved_link_groups(placement=self.request.query_params.get('placement'))


@extend_schema(summary='Banner đang bật theo vị trí', tags=['site'])
class BannerListView(generics.ListAPIView):
    """Banner đang bật, sắp theo order. Lọc theo ?placement=home_hero."""

    serializer_class = BannerSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_banners(placement=self.request.query_params.get('placement'))


@extend_schema(summary='Gửi góp ý sản phẩm', tags=['site'])
class FeedbackCreateView(generics.CreateAPIView):
    """Nhận góp ý sản phẩm từ nút nổi "Góp ý". Khách chưa đăng nhập vẫn gửi được."""

    serializer_class = FeedbackSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'feedback'

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.instance = submit_feedback(user=user, **serializer.validated_data)
