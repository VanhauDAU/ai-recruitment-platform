from rest_framework import generics
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import IsEmployerWithMFA

from ...selectors import (
    employer_application_queryset,
    employer_applications_queryset,
)
from ...services import (
    InvalidApplicationStatusTransition,
    update_application_status,
)
from ..serializers.employer import ApplicationSerializer, ApplicationStatusUpdateSerializer


class EmployerApplicationListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsEmployerWithMFA]

    def get_queryset(self):
        return employer_applications_queryset(
            self.request.user, self.request.query_params.get('job')
        )


class EmployerApplicationStatusUpdateView(generics.UpdateAPIView):
    serializer_class = ApplicationStatusUpdateSerializer
    permission_classes = [IsEmployerWithMFA]
    lookup_field = 'public_id'

    def get_queryset(self):
        return employer_application_queryset(self.request.user)

    def perform_update(self, serializer):
        try:
            update_application_status(serializer)
        except InvalidApplicationStatusTransition as error:
            raise ValidationError({'status': str(error)}) from error
