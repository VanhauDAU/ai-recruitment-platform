import csv

from django.core.cache import cache
from django.db.models import ProtectedError
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import HasAdminPermission
from apps.accounts.services import record_admin_action

from ...models import ConsultationLead, ServicePackage
from ...selectors import (
    active_public_categories_queryset,
    admin_leads_queryset,
    admin_service_categories_queryset,
)
from ...signals import PUBLIC_PACKAGES_CACHE_KEY
from ..serializers import (
    AdminConsultationLeadQuerySerializer,
    AdminConsultationLeadSerializer,
    AdminServiceCategorySerializer,
    AdminServicePackageSerializer,
    ConsultationLeadCreateSerializer,
    PublicServiceCategorySerializer,
)

ADMIN_CONSULTATION_LEAD_EXPORT_LIMIT = 10_000
CSV_FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def _validated_lead_query(query_params):
    serializer = AdminConsultationLeadQuerySerializer(data=query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def _csv_cell(value):
    """Prevent spreadsheet formula execution when exported CSV is opened."""

    text = str(value or '')
    return f"'{text}" if text.startswith(CSV_FORMULA_PREFIXES) else text


@extend_schema(
    summary='Báo giá công khai: nhóm dịch vụ kèm gói (cache 1h)',
    responses={200: PublicServiceCategorySerializer(many=True)},
    tags=['services'],
)
class PublicServicePackageListView(APIView):
    """Báo giá công khai: nhóm dịch vụ active kèm các gói active, đã sắp thứ tự.

    Cache 1h (LocMemCache); signal post_save/post_delete tự xoá khi admin sửa.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = cache.get(PUBLIC_PACKAGES_CACHE_KEY)
        if data is None:
            categories = active_public_categories_queryset()
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
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['service_catalog.view'],
        'POST': ['service_catalog.manage'],
    }
    pagination_class = None
    queryset = admin_service_categories_queryset()


class AdminServiceCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminServiceCategorySerializer
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['service_catalog.view'],
        'PUT': ['service_catalog.manage'],
        'PATCH': ['service_catalog.manage'],
        'DELETE': ['service_catalog.manage'],
    }
    queryset = admin_service_categories_queryset()

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
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['service_catalog.view'],
        'POST': ['service_catalog.manage'],
    }
    pagination_class = None
    queryset = ServicePackage.objects.select_related('category').all()


class AdminServicePackageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminServicePackageSerializer
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['service_catalog.view'],
        'PUT': ['service_catalog.manage'],
        'PATCH': ['service_catalog.manage'],
        'DELETE': ['service_catalog.manage'],
    }
    queryset = ServicePackage.objects.select_related('category').all()


@extend_schema(
    parameters=[AdminConsultationLeadQuerySerializer],
    tags=['services-admin'],
)
class AdminConsultationLeadListView(generics.ListAPIView):
    """Danh sách lead tư vấn với filter và ordering phía server."""

    serializer_class = AdminConsultationLeadSerializer
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['consultation_lead.view']}

    def get_queryset(self):
        return admin_leads_queryset(_validated_lead_query(self.request.query_params))


@extend_schema(
    summary='Xuất CSV lead tư vấn theo bộ lọc hiện tại',
    parameters=[AdminConsultationLeadQuerySerializer],
    responses={(200, 'text/csv'): OpenApiTypes.BINARY},
    tags=['services-admin'],
)
class AdminConsultationLeadExportView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['consultation_lead.view', 'consultation_lead.export']}

    def get(self, request):
        params = _validated_lead_query(request.query_params)
        leads = list(admin_leads_queryset(params)[: ADMIN_CONSULTATION_LEAD_EXPORT_LIMIT + 1])
        truncated = len(leads) > ADMIN_CONSULTATION_LEAD_EXPORT_LIMIT
        leads = leads[:ADMIN_CONSULTATION_LEAD_EXPORT_LIMIT]

        filename = f'consultation-leads-{timezone.localdate().isoformat()}.csv'
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['X-Export-Row-Limit'] = str(ADMIN_CONSULTATION_LEAD_EXPORT_LIMIT)
        response['X-Export-Truncated'] = str(truncated).lower()
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(
            [
                'ID',
                'Khách hàng',
                'Công ty',
                'Email',
                'Số điện thoại',
                'Tỉnh/TP',
                'Nhu cầu',
                'Ghi chú',
                'Nguồn',
                'Trạng thái',
                'Ngày gửi',
            ]
        )
        for lead in leads:
            writer.writerow(
                [
                    lead.pk,
                    _csv_cell(lead.full_name),
                    _csv_cell(lead.company_name),
                    _csv_cell(lead.email),
                    _csv_cell(lead.phone),
                    _csv_cell(lead.province),
                    _csv_cell(lead.get_need_display()),
                    _csv_cell(lead.note),
                    _csv_cell(lead.source_page),
                    _csv_cell(lead.get_status_display()),
                    lead.created_at.isoformat(),
                ]
            )

        active_filter_names = [
            name for name in ('status', 'q', 'created_from', 'created_to') if params.get(name)
        ]
        record_admin_action(
            actor=request.user,
            action='export_consultation_leads',
            target_type='consultation_lead_export',
            target_public_id='',
            payload={
                'format': 'csv',
                'row_count': len(leads),
                'truncated': truncated,
                'row_limit': ADMIN_CONSULTATION_LEAD_EXPORT_LIMIT,
                'filter_names': active_filter_names,
                'ordering': params['ordering'],
            },
        )
        return response


class AdminConsultationLeadDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AdminConsultationLeadSerializer
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['consultation_lead.view'],
        'PUT': ['consultation_lead.manage'],
        'PATCH': ['consultation_lead.manage'],
    }
    queryset = ConsultationLead.objects.all()
