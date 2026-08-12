from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_job_workspace

from ...models import ServiceEntitlementUnit
from ...selectors import employer_active_job_service_activations
from ...services import (
    activate_job_service_with_confirmed_extension,
    preview_job_service_activation,
    refresh_promoted_job,
)
from ..serializers import (
    EmployerActivationRequestSerializer,
    EmployerActivationSerializer,
    EmployerServiceUnitSerializer,
    EmployerUsageSerializer,
)


def _company_for(request):
    recruiter, _ = ensure_recruiter_job_workspace(request.user)
    if recruiter is None or recruiter.company_id is None:
        raise ValidationError('Cập nhật thông tin công ty trước khi sử dụng dịch vụ.')
    return recruiter.company


def _require_activation_enabled():
    if not getattr(settings, 'SERVICE_ACTIVATION_ENABLED', False):
        raise NotFound('Dịch vụ kích hoạt đang được triển khai theo từng nhóm doanh nghiệp.')


def _require_refresh_enabled():
    _require_activation_enabled()
    if not getattr(settings, 'JOB_PROMOTION_REFRESH_ENABLED', False):
        raise NotFound('Quyền lợi làm mới tin đang được triển khai theo từng nhóm doanh nghiệp.')


def _raise_domain_validation(error):
    detail = getattr(error, 'message_dict', None) or getattr(error, 'messages', None)
    raise ValidationError(detail or str(error)) from error


class EmployerServiceInventoryView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        _require_activation_enabled()
        company = _company_for(request)
        units = (
            ServiceEntitlementUnit.objects.select_related('package_version__package')
            .filter(company=company)
            .order_by('activate_by', 'id')
        )
        return Response(EmployerServiceUnitSerializer(units, many=True).data)


class EmployerActiveServiceListView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        _require_activation_enabled()
        company = _company_for(request)
        activations = employer_active_job_service_activations(
            company=company,
            job_public_id=request.query_params.get('job_public_id', '').strip(),
        )
        return Response(EmployerActivationSerializer(activations, many=True).data)


class EmployerServiceActivationPreviewView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request):
        _require_activation_enabled()
        _company_for(request)
        serializer = EmployerActivationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            preview = preview_job_service_activation(
                unit=serializer.validated_data['unit'],
                job=serializer.validated_data['job'],
                actor=request.user,
            )
        except DjangoValidationError as error:
            _raise_domain_validation(error)
        return Response(preview)


class EmployerServiceActivationCreateView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request):
        _require_activation_enabled()
        _company_for(request)
        idempotency_key = request.headers.get('Idempotency-Key', '').strip()
        if not idempotency_key:
            raise ValidationError({'idempotency_key': 'Thiếu header Idempotency-Key.'})
        serializer = EmployerActivationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            activation = activate_job_service_with_confirmed_extension(
                unit=serializer.validated_data['unit'],
                job=serializer.validated_data['job'],
                actor=request.user,
                idempotency_key=idempotency_key,
                confirm_extension=serializer.validated_data['confirm_extension'],
            )
        except DjangoValidationError as error:
            _raise_domain_validation(error)
        activation = (
            type(activation).objects.prefetch_related('items__capability').get(pk=activation.pk)
        )
        return Response(
            EmployerActivationSerializer(activation).data,
            status=status.HTTP_201_CREATED,
        )


class EmployerServiceRefreshView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        _require_refresh_enabled()
        company = _company_for(request)
        activation = (
            employer_active_job_service_activations(company=company)
            .filter(public_id=public_id)
            .first()
        )
        if activation is None:
            raise NotFound('Không tìm thấy dịch vụ đang chạy.')
        idempotency_key = request.headers.get('Idempotency-Key', '').strip()
        if not idempotency_key:
            raise ValidationError({'idempotency_key': 'Thiếu header Idempotency-Key.'})
        try:
            usage = refresh_promoted_job(
                activation=activation,
                actor=request.user,
                idempotency_key=idempotency_key,
            )
        except DjangoValidationError as error:
            _raise_domain_validation(error)
        usage = type(usage).objects.select_related('activation', 'activation_item').get(pk=usage.pk)
        return Response(EmployerUsageSerializer(usage).data, status=status.HTTP_201_CREATED)
