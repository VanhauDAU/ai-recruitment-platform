from rest_framework import generics
from apps.accounts.permissions import IsEmployer

from ...selectors import employer_jobs_queryset
from ...services import create_pending_job, update_employer_job
from ..serializers import EmployerJobSerializer


class EmployerJobListCreateView(generics.ListCreateAPIView):
    serializer_class = EmployerJobSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return employer_jobs_queryset(self.request.user)

    def perform_create(self, serializer):
        create_pending_job(serializer, self.request.user)


class EmployerJobDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EmployerJobSerializer
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_queryset(self):
        return employer_jobs_queryset(self.request.user)

    def perform_update(self, serializer):
        update_employer_job(serializer)
