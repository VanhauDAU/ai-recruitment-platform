import re

from django.core.cache import cache
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from apps.common.media_storage import save_image_upload

from .models import Banner, LinkGroup, SiteSetting
from .serializers import AdminSiteSettingSerializer, BannerSerializer, LinkGroupSerializer
from .signals import PUBLIC_SETTINGS_CACHE_KEY

_HEX_COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')


class SiteSettingListView(APIView):
    """Trả về cấu hình công khai dạng {key: value} để frontend dùng trực tiếp.

    Cache 1h (LocMemCache); signal post_save/post_delete tự xoá khi admin sửa.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = cache.get(PUBLIC_SETTINGS_CACHE_KEY)
        if data is None:
            data = {s.key: s.value for s in SiteSetting.objects.filter(is_public=True)}
            cache.set(PUBLIC_SETTINGS_CACHE_KEY, data, 60 * 60)
        return Response(data)


def _validate_value(setting, value):
    """Kiểm tra value theo value_type; trả về (value đã chuẩn hoá, lỗi hoặc None)."""
    vt = SiteSetting.ValueType
    if setting.value_type == vt.ENV:
        return None, 'Giá trị này cấu hình qua .env, không sửa được qua API.'
    if setting.value_type == vt.BOOLEAN and not isinstance(value, bool):
        return None, 'Giá trị phải là true/false.'
    if setting.value_type == vt.NUMBER and (isinstance(value, bool) or not isinstance(value, (int, float))):
        return None, 'Giá trị phải là số.'
    if setting.value_type == vt.COLOR and not (isinstance(value, str) and _HEX_COLOR.match(value)):
        return None, 'Giá trị phải là mã màu hex, vd: #00b14f.'
    if setting.value_type == vt.SELECT:
        choices = [c.get('value') for c in setting.options.get('choices', [])]
        if value not in choices:
            return None, f'Giá trị phải thuộc: {", ".join(map(str, choices))}.'
    if setting.value_type in {vt.TEXT, vt.TEXTAREA, vt.EMAIL, vt.URL, vt.IMAGE} and not isinstance(value, str):
        return None, 'Giá trị phải là chuỗi.'
    return value, None


class AdminSiteSettingView(APIView):
    """GET: toàn bộ cấu hình gộp theo 15 nhóm. PATCH: cập nhật hàng loạt value."""

    permission_classes = [IsAdmin]

    def get(self, request):
        by_group = {}
        for setting in SiteSetting.objects.order_by('group', 'order', 'key'):
            by_group.setdefault(setting.group, []).append(setting)
        groups = [
            {'key': key, 'label': label, 'settings': AdminSiteSettingSerializer(by_group.get(key, []), many=True).data}
            for key, label in SiteSetting.Group.choices
        ]
        return Response({'groups': groups})

    def patch(self, request):
        values = request.data.get('values')
        if not isinstance(values, dict):
            return Response({'detail': 'Body phải có dạng {"values": {key: value}}.'},
                            status=status.HTTP_400_BAD_REQUEST)

        settings_map = {s.key: s for s in SiteSetting.objects.filter(key__in=values.keys())}
        updated, errors = [], {}
        with transaction.atomic():
            for key, value in values.items():
                setting = settings_map.get(key)
                if setting is None:
                    errors[key] = 'Không tồn tại key này.'
                    continue
                value, error = _validate_value(setting, value)
                if error:
                    errors[key] = error
                    continue
                if setting.value != value:
                    setting.value = value
                    setting.save(update_fields=['value', 'updated_at'])
                updated.append(key)
        return Response({'updated': updated, 'errors': errors},
                        status=status.HTTP_400_BAD_REQUEST if errors and not updated else status.HTTP_200_OK)


# Setting nào cần giới hạn kích thước pixel lúc upload (tránh admin upload ảnh
# gốc to làm icon nhỏ, nặng trang mà không hay biết — vd favicon).
UPLOAD_MAX_DIMENSIONS = {
    'brand_favicon_url': (256, 256),
}


class AdminSettingUploadView(APIView):
    """Upload ảnh cho setting kiểu image (logo, favicon, ảnh OG...)."""

    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get('file')
        if upload is None:
            return Response({'detail': 'Thiếu file upload.'}, status=status.HTTP_400_BAD_REQUEST)
        max_dimensions = UPLOAD_MAX_DIMENSIONS.get(request.data.get('key'))
        saved = save_image_upload(upload, 'site/settings', request=request, max_dimensions=max_dimensions)
        return Response({'url': saved['url']}, status=status.HTTP_201_CREATED)


class LinkGroupListView(generics.ListAPIView):
    """Các cụm link đang bật, kèm items đã resolve. Lọc theo ?placement=footer_seo."""

    serializer_class = LinkGroupSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = LinkGroup.objects.filter(is_active=True).prefetch_related('items')
        if placement := self.request.query_params.get('placement'):
            qs = qs.filter(placement=placement)
        return qs


class BannerListView(generics.ListAPIView):
    """Banner đang bật, sắp theo order. Lọc theo ?placement=home_hero."""

    serializer_class = BannerSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = Banner.objects.filter(is_active=True)
        if placement := self.request.query_params.get('placement'):
            qs = qs.filter(placement=placement)
        return qs
