from rest_framework import generics
from apps.accounts.permissions import IsEmployer

from ...models import Job
from ...services import create_pending_job
from ..serializers import EmployerJobSerializer


class EmployerJobListCreateView(generics.ListCreateAPIView):
    serializer_class = EmployerJobSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return (
            Job.objects.filter(posted_by=self.request.user)
            .select_related('company')
            .prefetch_related(
                'category_assignments__category', 'job_locations__location__parent',
                'job_skills__skill', 'work_schedules', 'job_benefits__benefit',
                'language_requirements__language', 'application_contact__emails',
            )
            .order_by('-created_at')
        )

    def perform_create(self, serializer):
        create_pending_job(serializer, self.request.user)


class EmployerJobDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EmployerJobSerializer
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_queryset(self):
        return (
            Job.objects.filter(posted_by=self.request.user)
            .select_related('company')
            .prefetch_related(
                'category_assignments__category', 'job_locations__location__parent',
                'job_skills__skill', 'work_schedules', 'job_benefits__benefit',
                'language_requirements__language', 'application_contact__emails',
            )
        )
