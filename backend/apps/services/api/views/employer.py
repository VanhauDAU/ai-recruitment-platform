from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_job_workspace

from ...models import ServiceEntitlementUnit
from ...services import (
    activate_job_service_with_confirmed_extension,
    preview_job_service_activation,
)
from ..serializers import (
    EmployerActivationRequestSerializer,
    EmployerActivationSerializer,
    EmployerServiceUnitSerializer,
)


def _company_for(request):
    recruiter, _ = ensure_recruiter_job_workspace(request.user)
    if recruiter is None or recruiter.company_id is None:
        raise ValidationError('Cập nhật thông tin công ty trước khi sử dụng dịch vụ.')
    return recruiter.company


def _raise_domain_validation(error):
    detail = getattr(error, 'message_dict', None) or getattr(error, 'messages', None)
    raise ValidationError(detail or str(error)) from error


class EmployerServiceInventoryView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        company = _company_for(request)
        units = (
            ServiceEntitlementUnit.objects.select_related('package_version__package')
            .filter(company=company)
            .order_by('activate_by', 'id')
        )
        return Response(EmployerServiceUnitSerializer(units, many=True).data)


class EmployerServiceActivationPreviewView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request):
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
