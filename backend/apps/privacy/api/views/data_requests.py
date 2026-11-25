"""Yêu cầu của chủ thể dữ liệu: người dùng tự gửi, quản trị viên xử lý."""

import json

from django.core.serializers.json import DjangoJSONEncoder
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission, IsCandidate, IsEmployer
from apps.privacy.api.serializers import (
    AdminDataRequestDecisionSerializer,
    AdminDataRequestQuerySerializer,
    AdminDataRequestSerializer,
    DataRequestCreateSerializer,
    DataRequestSerializer,
)
from apps.privacy.models import DataSubjectRequest
from apps.privacy.selectors import (
    admin_data_requests_queryset,
    build_personal_data_export,
    own_data_requests,
)
from apps.privacy.services import (
    cancel_data_request,
    complete_data_request,
    ensure_export_downloadable,
    reject_data_request,
    submit_data_request,
)

ACCOUNT_HOLDER = [IsCandidate | IsEmployer]


def _own_request(request, public_id):
    return get_object_or_404(DataSubjectRequest, user=request.user, public_id=public_id)


class OwnDataRequestListCreateView(APIView):
    permission_classes = ACCOUNT_HOLDER

    @extend_schema(
        summary='Yêu cầu xóa tài khoản / xuất dữ liệu của tôi',
        responses=DataRequestSerializer(many=True),
        tags=['privacy'],
    )
    def get(self, request):
        return Response(DataRequestSerializer(own_data_requests(request.user), many=True).data)

    @extend_schema(
        summary='Gửi yêu cầu xóa tài khoản hoặc xuất dữ liệu',
        request=DataRequestCreateSerializer,
        responses={201: DataRequestSerializer},
        tags=['privacy'],
    )
    def post(self, request):
        serializer = DataRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data_request = submit_data_request(request.user, **serializer.validated_data)
        return Response(DataRequestSerializer(data_request).data, status=status.HTTP_201_CREATED)


class OwnDataRequestCancelView(APIView):
    permission_classes = ACCOUNT_HOLDER

    @extend_schema(
        summary='Hủy yêu cầu đang chờ xử lý',
        request=None,
        responses=DataRequestSerializer,
        tags=['privacy'],
    )
    def post(self, request, public_id):
        data_request = cancel_data_request(_own_request(request, public_id), user=request.user)
        return Response(DataRequestSerializer(data_request).data)


class OwnDataRequestExportView(APIView):
    permission_classes = ACCOUNT_HOLDER

    @extend_schema(
        summary='Tải bản xuất dữ liệu cá nhân (JSON)',
        responses={(200, 'application/json'): OpenApiTypes.OBJECT},
        tags=['privacy'],
    )
    def get(self, request, public_id):
        data_request = _own_request(request, public_id)
        ensure_export_downloadable(data_request, user=request.user)
        body = json.dumps(
            build_personal_data_export(request.user),
            cls=DjangoJSONEncoder,
            ensure_ascii=False,
            indent=2,
        )
        response = HttpResponse(body, content_type='application/json; charset=utf-8')
        filename = f'procv-du-lieu-{request.user.public_id}.json'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Cache-Control'] = 'no-store'
        return response


@extend_schema_view(
    list=extend_schema(
        summary='Hàng chờ yêu cầu của chủ thể dữ liệu',
        parameters=[AdminDataRequestQuerySerializer],
        tags=['privacy'],
    )
)
class AdminDataRequestViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminDataRequestSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        if self.action != 'list':
            return admin_data_requests_queryset()
        query = AdminDataRequestQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return admin_data_requests_queryset(
            status=query.validated_data.get('status'), kind=query.validated_data.get('kind')
        )

    def _decide(self, request, decide):
        serializer = AdminDataRequestDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decide(
            self.get_object(), actor=request.user, note=serializer.validated_data.get('note', '')
        )
        return Response(self.get_serializer(self.get_object()).data)

    @extend_schema(
        summary='Hoàn tất yêu cầu (xóa tài khoản: ẩn danh hóa và xóa CV)',
        request=AdminDataRequestDecisionSerializer,
        responses={200: AdminDataRequestSerializer},
        tags=['privacy'],
    )
    @action(detail=True, methods=['post'])
    def complete(self, request, public_id=None):
        return self._decide(request, complete_data_request)

    @extend_schema(
        summary='Từ chối yêu cầu kèm lý do',
        request=AdminDataRequestDecisionSerializer,
        responses={200: AdminDataRequestSerializer},
        tags=['privacy'],
    )
    @action(detail=True, methods=['post'])
    def reject(self, request, public_id=None):
        return self._decide(request, reject_data_request)
