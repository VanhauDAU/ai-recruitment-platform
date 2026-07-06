from django.utils import timezone
from rest_framework import generics, permissions

from apps.accounts.permissions import IsCandidate, IsEmployer

from .models import Application
from .serializers import ApplicationSerializer, ApplicationStatusUpdateSerializer

STATUS_TIMESTAMP_FIELD = {
    Application.Status.VIEWED: 'viewed_at',
    Application.Status.SHORTLISTED: 'shortlisted_at',
    Application.Status.INTERVIEWED: 'interviewed_at',
    Application.Status.REJECTED: 'rejected_at',
    Application.Status.ACCEPTED: 'accepted_at',
}


class CandidateApplicationListCreateView(generics.ListCreateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsCandidate]

    def get_queryset(self):
        return Application.objects.filter(candidate=self.request.user).select_related('job', 'cv').order_by('-applied_at')

    def perform_create(self, serializer):
        serializer.save(candidate=self.request.user)


class EmployerApplicationListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        qs = Application.objects.filter(job__employer=self.request.user).select_related('job', 'cv')
        if job_id := self.request.query_params.get('job'):
            qs = qs.filter(job__public_id=job_id)
        return qs.order_by('-applied_at')


class EmployerApplicationStatusUpdateView(generics.UpdateAPIView):
    serializer_class = ApplicationStatusUpdateSerializer
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_queryset(self):
        return Application.objects.filter(job__employer=self.request.user)

    def perform_update(self, serializer):
        new_status = serializer.validated_data.get('status')
        extra_fields = {}
        if new_status and (timestamp_field := STATUS_TIMESTAMP_FIELD.get(new_status)):
            extra_fields[timestamp_field] = timezone.now()
        serializer.save(**extra_fields)
