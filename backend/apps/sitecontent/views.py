import json
import re

from django.core.cache import cache
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from common.media_storage import (
    delete_local_media_url,
    media_storage_path,
    media_url_from_value,
    normalise_media_value,
    save_image_upload,
)

from .models import Banner, LinkGroup, Locale, SiteSetting
from .serializers import (
    AdminSiteSettingSerializer,
    AdminLocaleSerializer,
    BannerSerializer,
    FeedbackSerializer,
    LinkGroupSerializer,
    LocaleSerializer,
)
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
            data = {
                s.key: (s.value, s.value_type == SiteSetting.ValueType.IMAGE)
                for s in SiteSetting.objects.filter(is_public=True)
            }
            cache.set(PUBLIC_SETTINGS_CACHE_KEY, data, 60 * 60)
        # Cache storage keys, không cache URL tuyệt đối. Nhờ vậy thay domain/CDN
        # không làm database hay cache giữ lại localhost/domain cũ.
        return Response({
            key: media_url_from_value(value, request=request) if is_image else value
            for key, (value, is_image) in data.items()
        })


class LocaleListView(generics.ListAPIView):
    serializer_class = LocaleSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return Locale.objects.filter(is_active=True)


class AdminLocaleListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminLocaleSerializer
    permission_classes = [IsAdmin]
    pagination_class = None
    queryset = Locale.objects.all()


class AdminLocaleDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AdminLocaleSerializer
    permission_classes = [IsAdmin]
    queryset = Locale.objects.all()
    lookup_field = 'code'


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
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get(self, request):
        by_group = {}
        for setting in SiteSetting.objects.order_by('group', 'order', 'key'):
            by_group.setdefault(setting.group, []).append(setting)
        groups = [
            {
                'key': key,
                'label': label,
                'settings': AdminSiteSettingSerializer(
                    by_group.get(key, []), many=True, context={'request': request},
                ).data,
            }
            for key, label in SiteSetting.Group.choices
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
            return Response({'detail': 'Body phải có dạng {"values": {key: value}}.'},
                            status=status.HTTP_400_BAD_REQUEST)

        image_uploads = {}
        for field_name, upload in request.FILES.items():
            match = re.fullmatch(r'files\[(.+)]', field_name)
            image_uploads[match.group(1) if match else field_name] = upload

        keys = set(values.keys()) | set(image_uploads.keys())
        settings_map = {s.key: s for s in SiteSetting.objects.filter(key__in=keys)}
        updated, errors, saved_values, display_values, saved_paths = [], {}, {}, {}, []
        try:
            with transaction.atomic():
                for key, value in values.items():
                    if key in image_uploads:
                        continue
                    setting = settings_map.get(key)
                    if setting is None:
                        errors[key] = 'Không tồn tại key này.'
                        continue
                    value, error = _validate_value(setting, value)
                    if error:
                        errors[key] = error
                        continue
                    if setting.value_type == SiteSetting.ValueType.IMAGE:
                        value = normalise_media_value(value)
                    if setting.value != value:
                        old_value = setting.value
                        setting.value = value
                        setting.save(update_fields=['value', 'updated_at'])
                        # Chỉ xoá file cũ sau khi transaction đã commit. URL ngoài
                        # hệ thống sẽ không bao giờ bị động tới.
                        if media_storage_path(old_value) != media_storage_path(value):
                            transaction.on_commit(
                                lambda old_value=old_value: delete_local_media_url(old_value)
                            )
                    updated.append(key)
                    saved_values[key] = setting.value
                    if setting.value_type == SiteSetting.ValueType.IMAGE:
                        display_values[key] = media_url_from_value(setting.value, request=request)

                for key, upload in image_uploads.items():
                    setting = settings_map.get(key)
                    if setting is None:
                        errors[key] = 'Không tồn tại key này.'
                        continue
                    if setting.value_type != SiteSetting.ValueType.IMAGE:
                        errors[key] = 'Cấu hình này không phải kiểu ảnh.'
                        continue

                    saved = save_image_upload(
                        upload,
                        'site/settings',
                        request=request,
                        max_dimensions=UPLOAD_MAX_DIMENSIONS.get(key),
                    )
                    saved_paths.append(saved['path'])
                    old_value = setting.value
                    setting.value = saved['path']
                    setting.save(update_fields=['value', 'updated_at'])
                    if media_storage_path(old_value) != saved['path']:
                        transaction.on_commit(
                            lambda old_value=old_value: delete_local_media_url(old_value)
                        )
                    updated.append(key)
                    saved_values[key] = setting.value
                    display_values[key] = media_url_from_value(setting.value, request=request)
        except Exception:
            for path in saved_paths:
                delete_local_media_url(path)
            raise

        return Response({'updated': updated, 'errors': errors, 'values': saved_values, 'display_values': display_values},
                        status=status.HTTP_400_BAD_REQUEST if errors and not updated else status.HTTP_200_OK)


# Setting nào cần giới hạn kích thước pixel lúc upload (tránh admin upload ảnh
# gốc to làm icon nhỏ, nặng trang mà không hay biết — vd favicon).
UPLOAD_MAX_DIMENSIONS = {
    'brand_favicon_url': (256, 256),
    'footer_logo_url': (1600, 600),
    'footer_qr_code_url': (1200, 1200),
}


class AdminSettingUploadView(APIView):
    """Endpoint cũ: upload riêng từng ảnh.

    Luồng admin hiện dùng PATCH /admin/settings/ để lưu thủ công theo nút
    "Lưu thay đổi", nên endpoint này không còn ghi setting để tránh auto-save.
    """

    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser]

    def post(self, request):
        return Response({
            'detail': 'Endpoint này đã ngưng dùng. Hãy gửi file cùng PATCH /api/site/admin/settings/ khi bấm lưu.'
        }, status=status.HTTP_410_GONE)


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


class FeedbackCreateView(generics.CreateAPIView):
    """Nhận góp ý sản phẩm từ nút nổi "Góp ý". Khách chưa đăng nhập vẫn gửi được."""

    serializer_class = FeedbackSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'feedback'

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        # Người đã đăng nhập bỏ trống ô email -> lấy email tài khoản để còn phản hồi được.
        email = serializer.validated_data.get('email') or (user.email if user else '')
        serializer.save(user=user, email=email)
