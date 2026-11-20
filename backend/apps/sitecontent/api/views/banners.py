from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission
from apps.employers.selectors import attach_active_public_job_counts

from ...models import Banner
from ...selectors import active_banners, admin_banners
from ...services import (
    create_banner,
    delete_banner,
    reorder_banners,
    update_banner,
    upload_banner_image,
)
from ..serializers import (
    AdminBannerSerializer,
    BannerImageUploadSerializer,
    BannerReorderSerializer,
    BannerSerializer,
    BannerWriteSerializer,
)

PLACEMENT_PARAM = OpenApiParameter('placement', str, enum=Banner.Placement.values)


def _with_job_counts(banners):
    """Gắn số tin đang tuyển cho mọi công ty của slide bằng một truy vấn gộp."""
    banners = list(banners)
    companies = {banner.company_id: banner.company for banner in banners if banner.company_id}
    attach_active_public_job_counts(companies.values())
    return banners


@extend_schema(summary='Banner đang chạy theo vị trí', parameters=[PLACEMENT_PARAM], tags=['site'])
class BannerListView(generics.ListAPIView):
    """Banner đang bật và trong lịch chạy, sắp theo order. Lọc theo ?placement=home_hero."""

    serializer_class = BannerSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return _with_job_counts(
            active_banners(placement=self.request.query_params.get('placement'))
        )


def _admin_detail(request, banner, response_status=status.HTTP_200_OK):
    # Đọc lại qua selector để có số tin đang tuyển của công ty gắn kèm.
    [banner] = _with_job_counts(admin_banners(pk=banner.pk))
    return Response(
        AdminBannerSerializer(banner, context={'request': request}).data, status=response_status
    )


@extend_schema_view(
    get=extend_schema(
        summary='Admin: danh sách banner theo vị trí',
        parameters=[PLACEMENT_PARAM],
        responses={200: AdminBannerSerializer(many=True)},
        tags=['site-banners-admin'],
    ),
    post=extend_schema(
        summary='Admin: tạo banner',
        request=BannerWriteSerializer,
        responses={201: AdminBannerSerializer},
        tags=['site-banners-admin'],
    ),
)
class AdminBannerListCreateView(APIView):
    permission_classes = [AdminPortalPermission]

    def get(self, request):
        banners = _with_job_counts(admin_banners(placement=request.query_params.get('placement')))
        return Response(
            AdminBannerSerializer(banners, many=True, context={'request': request}).data
        )

    def post(self, request):
        serializer = BannerWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        banner = create_banner(actor=request.user, data=serializer.validated_data)
        return _admin_detail(request, banner, status.HTTP_201_CREATED)


@extend_schema_view(
    patch=extend_schema(
        summary='Admin: sửa banner',
        request=BannerWriteSerializer,
        responses={200: AdminBannerSerializer},
        tags=['site-banners-admin'],
    ),
    delete=extend_schema(
        summary='Admin: xóa banner', responses={204: None}, tags=['site-banners-admin']
    ),
)
class AdminBannerDetailView(APIView):
    permission_classes = [AdminPortalPermission]

    def patch(self, request, pk):
        banner = get_object_or_404(Banner, pk=pk)
        serializer = BannerWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        banner = update_banner(actor=request.user, banner=banner, data=serializer.validated_data)
        return _admin_detail(request, banner)

    def delete(self, request, pk):
        delete_banner(actor=request.user, banner=get_object_or_404(Banner, pk=pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary='Admin: sắp lại thứ tự banner của một vị trí',
    request=BannerReorderSerializer,
    responses={204: None},
    tags=['site-banners-admin'],
)
class AdminBannerReorderView(APIView):
    permission_classes = [AdminPortalPermission]

    def post(self, request):
        serializer = BannerReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reorder_banners(actor=request.user, **serializer.validated_data)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary='Admin: tải ảnh banner',
    request={'multipart/form-data': BannerImageUploadSerializer},
    responses={201: dict},
    tags=['site-banners-admin'],
)
class AdminBannerImageUploadView(APIView):
    """Kiểm tra theo vị trí và loại slide (slide ảnh trang chủ cần tỉ lệ 8:3)."""

    permission_classes = [AdminPortalPermission]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = BannerImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        saved = upload_banner_image(
            upload=data['file'], placement=data['placement'], kind=data['kind'], request=request
        )
        return Response(saved, status=status.HTTP_201_CREATED)
