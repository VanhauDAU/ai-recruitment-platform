from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Banner, LinkGroup, SiteSetting
from .serializers import BannerSerializer, LinkGroupSerializer


class SiteSettingListView(APIView):
    """Trả về cấu hình công khai dạng {key: value} để frontend dùng trực tiếp."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        settings = SiteSetting.objects.filter(is_public=True)
        return Response({s.key: s.value for s in settings})


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
