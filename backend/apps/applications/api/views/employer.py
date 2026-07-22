from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsEmployer

from ...selectors import (
    employer_application_queryset,
    employer_applications_queryset,
)
from ...services import (
    InvalidApplicationStatusTransition,
    update_application_status,
)
from ..serializers.employer import ApplicationSerializer, ApplicationStatusUpdateSerializer
from ..serializers.history import ApplicationStatusHistorySerializer


class EmployerApplicationListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return employer_applications_queryset(
            self.request.user,
            self.request.query_params.get('job'),
            status=self.request.query_params.get('status'),
            campaign=self.request.query_params.get('campaign'),
            q=self.request.query_params.get('q'),
        )


class EmployerApplicationStatusUpdateView(generics.UpdateAPIView):
    serializer_class = ApplicationStatusUpdateSerializer
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_queryset(self):
        return employer_application_queryset(self.request.user)

    def perform_update(self, serializer):
        try:
            update_application_status(serializer, changed_by=self.request.user)
        except InvalidApplicationStatusTransition as error:
            raise ValidationError({'status': str(error)}) from error

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        application = self.get_object()
        serializer = self.get_serializer(application, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        application = employer_applications_queryset(self.request.user).get(pk=application.pk)
        return Response(ApplicationSerializer(application).data)


class EmployerApplicationHistoryView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = ApplicationStatusHistorySerializer

    def get_queryset(self):
        application = get_object_or_404(
            employer_application_queryset(self.request.user), public_id=self.kwargs['public_id']
        )
        return application.status_history.select_related('changed_by')
