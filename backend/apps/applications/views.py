from rest_framework import generics
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import IsCandidate, IsEmployer

from .models import Application
from .serializers import ApplicationSerializer, ApplicationStatusUpdateSerializer
from .selectors import (
    candidate_applications_queryset,
    employer_application_queryset,
    employer_applications_queryset,
)
from .services import (
    InvalidApplicationStatusTransition,
    create_application,
    update_application_status,
)


class CandidateApplicationListCreateView(generics.ListCreateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsCandidate]

    def get_queryset(self):
        return candidate_applications_queryset(self.request.user)

    def perform_create(self, serializer):
        create_application(serializer, self.request.user)


class EmployerApplicationListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return employer_applications_queryset(self.request.user, self.request.query_params.get('job'))


class EmployerApplicationStatusUpdateView(generics.UpdateAPIView):
    serializer_class = ApplicationStatusUpdateSerializer
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_queryset(self):
        return employer_application_queryset(self.request.user)

    def perform_update(self, serializer):
        try:
            update_application_status(serializer)
        except InvalidApplicationStatusTransition as error:
            raise ValidationError({'status': str(error)}) from error
