from django.core.cache import cache
from django.db.models import Prefetch, ProtectedError
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin

from .models import ConsultationLead, ServiceCategory, ServicePackage
from .serializers import (
    AdminConsultationLeadSerializer,
    AdminServiceCategorySerializer,
    AdminServicePackageSerializer,
    ConsultationLeadCreateSerializer,
    PublicServiceCategorySerializer,
)
from .signals import PUBLIC_PACKAGES_CACHE_KEY


class PublicServicePackageListView(APIView):
    """Báo giá công khai: nhóm dịch vụ active kèm các gói active, đã sắp thứ tự.

    Cache 1h (LocMemCache); signal post_save/post_delete tự xoá khi admin sửa.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = cache.get(PUBLIC_PACKAGES_CACHE_KEY)
        if data is None:
            categories = ServiceCategory.objects.filter(is_active=True).prefetch_related(
                Prefetch(
                    'packages',
                    queryset=ServicePackage.objects.filter(is_active=True).order_by(
                        'order', 'slug'
                    ),
                    to_attr='active_packages',
                )
            )
            data = PublicServiceCategorySerializer(categories, many=True).data
            cache.set(PUBLIC_PACKAGES_CACHE_KEY, data, 60 * 60)
        return Response(data)


class ConsultationLeadCreateView(generics.CreateAPIView):
    """Nhận yêu cầu tư vấn từ form marketing NTD. Khách chưa đăng nhập vẫn gửi được."""

    serializer_class = ConsultationLeadCreateSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'consultation'


class AdminServiceCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminServiceCategorySerializer
    permission_classes = [IsAdmin]
    pagination_class = None
    queryset = ServiceCategory.objects.all()


class AdminServiceCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminServiceCategorySerializer
    permission_classes = [IsAdmin]
    queryset = ServiceCategory.objects.all()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    'detail': 'Nhóm này còn gói dịch vụ. Hãy xoá hoặc chuyển các gói sang nhóm khác trước.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class AdminServicePackageListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminServicePackageSerializer
    permission_classes = [IsAdmin]
    pagination_class = None
    queryset = ServicePackage.objects.select_related('category').all()


class AdminServicePackageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminServicePackageSerializer
    permission_classes = [IsAdmin]
    queryset = ServicePackage.objects.select_related('category').all()


class AdminConsultationLeadListView(generics.ListAPIView):
    """Danh sách lead tư vấn cho admin, mới nhất trước. Lọc theo ?status=new|contacted."""

    serializer_class = AdminConsultationLeadSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = ConsultationLead.objects.all()
        if lead_status := self.request.query_params.get('status'):
            qs = qs.filter(status=lead_status)
        return qs


class AdminConsultationLeadDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AdminConsultationLeadSerializer
    permission_classes = [IsAdmin]
    queryset = ConsultationLead.objects.all()
