from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasAdminPermission
from common.pagination import StandardPagination

from ...models import ServiceEntitlementUnit
from ...selectors import (
    admin_capabilities_queryset,
    admin_entitlement_units_queryset,
    admin_package_versions_queryset,
    admin_service_audit_queryset,
)
from ...services import (
    create_package_version_draft,
    grant_package_units,
    publish_package_version,
    revoke_entitlement_unit,
    save_package_version_draft,
)
from ..serializers import (
    AdminEntitlementGrantSerializer,
    AdminEntitlementQuerySerializer,
    AdminEntitlementRevokeSerializer,
    AdminEntitlementUnitSerializer,
    AdminPackageVersionQuerySerializer,
    AdminPackageVersionSerializer,
    AdminPackageVersionWriteSerializer,
    AdminServiceAuditQuerySerializer,
    AdminServiceAuditSerializer,
    AdminServiceCapabilitySerializer,
)


def _raise_service_validation(error):
    detail = getattr(error, 'message_dict', None) or getattr(error, 'messages', None)
    raise ValidationError(detail or str(error)) from error


class AdminServiceCapabilityListView(generics.ListAPIView):
    serializer_class = AdminServiceCapabilitySerializer
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['service_catalog.view']}
    pagination_class = None
    queryset = admin_capabilities_queryset()


class AdminPackageVersionListCreateView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['service_catalog.view'],
        'POST': ['service_catalog.draft.manage'],
    }

    def get(self, request):
        query = AdminPackageVersionQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        versions = admin_package_versions_queryset(
            package_id=query.validated_data.get('package'),
            status=query.validated_data.get('status'),
        )
        return Response(AdminPackageVersionSerializer(versions, many=True).data)

    def post(self, request):
        serializer = AdminPackageVersionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        package = values.pop('package')
        items = values.pop('items')
        try:
            version = create_package_version_draft(
                package=package,
                values=values,
                items=items,
            )
        except DjangoValidationError as error:
            _raise_service_validation(error)
        version = admin_package_versions_queryset().get(pk=version.pk)
        return Response(
            AdminPackageVersionSerializer(version).data,
            status=status.HTTP_201_CREATED,
        )


class AdminPackageVersionDetailView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['service_catalog.view'],
        'PUT': ['service_catalog.draft.manage'],
        'DELETE': ['service_catalog.draft.manage'],
    }

    def get_object(self, pk):
        return get_object_or_404(admin_package_versions_queryset(), pk=pk)

    def get(self, request, pk):
        return Response(AdminPackageVersionSerializer(self.get_object(pk)).data)

    def put(self, request, pk):
        version = self.get_object(pk)
        serializer = AdminPackageVersionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        package = values.pop('package')
        items = values.pop('items')
        if package.pk != version.package_id:
            raise ValidationError({'package': 'Không thể chuyển phiên bản sang gói khác.'})
        try:
            version = save_package_version_draft(
                package_version=version,
                values=values,
                items=items,
            )
        except DjangoValidationError as error:
            _raise_service_validation(error)
        version = admin_package_versions_queryset().get(pk=version.pk)
        return Response(AdminPackageVersionSerializer(version).data)

    def delete(self, request, pk):
        version = self.get_object(pk)
        try:
            version.delete()
        except DjangoValidationError as error:
            _raise_service_validation(error)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminPackageVersionPublishView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['service_catalog.publish']}

    def post(self, request, pk):
        version = get_object_or_404(admin_package_versions_queryset(), pk=pk)
        try:
            published = publish_package_version(
                package_version=version,
                actor=request.user,
            )
        except DjangoValidationError as error:
            _raise_service_validation(error)
        published = admin_package_versions_queryset().get(pk=published.pk)
        return Response(AdminPackageVersionSerializer(published).data)


class AdminEntitlementUnitListCreateView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['service_entitlement.view'],
        'POST': ['service_entitlement.manage'],
    }

    def get(self, request):
        query = AdminEntitlementQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        units = admin_entitlement_units_queryset(**query.validated_data)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(units, request, view=self)
        return paginator.get_paginated_response(
            AdminEntitlementUnitSerializer(page, many=True).data
        )

    def post(self, request):
        serializer = AdminEntitlementGrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            units = grant_package_units(
                **serializer.validated_data,
                actor=request.user,
            )
        except DjangoValidationError as error:
            _raise_service_validation(error)
        units = admin_entitlement_units_queryset().filter(pk__in=[unit.pk for unit in units])
        return Response(
            AdminEntitlementUnitSerializer(units, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class AdminEntitlementUnitRevokeView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['service_entitlement.manage']}

    def post(self, request, public_id):
        unit = get_object_or_404(ServiceEntitlementUnit, public_id=public_id)
        serializer = AdminEntitlementRevokeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            unit = revoke_entitlement_unit(
                unit=unit,
                actor=request.user,
                reason=serializer.validated_data['reason'],
            )
        except DjangoValidationError as error:
            _raise_service_validation(error)
        unit = admin_entitlement_units_queryset().get(pk=unit.pk)
        return Response(AdminEntitlementUnitSerializer(unit).data)


class AdminServiceAuditListView(generics.ListAPIView):
    serializer_class = AdminServiceAuditSerializer
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['service_audit.view']}
    pagination_class = StandardPagination

    def get_queryset(self):
        query = AdminServiceAuditQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return admin_service_audit_queryset(**query.validated_data)
