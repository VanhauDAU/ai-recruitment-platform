from django.db.models import F, Q
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import IsEmployer
from apps.employers.models import EmployerProfile

from .models import Job, JobCategory
from .serializers import JobCategorySerializer, JobSerializer


class JobCategoryListView(generics.ListAPIView):
    serializer_class = JobCategorySerializer
    permission_classes = [permissions.AllowAny]
    queryset = JobCategory.objects.filter(status=JobCategory.Status.ACTIVE)


class JobListView(generics.ListAPIView):
    serializer_class = JobSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Job.objects.filter(status=Job.Status.ACTIVE).select_related('employer_profile').prefetch_related('locations')
        params = self.request.query_params
        # Accepts multiple ?category= values at any taxonomy level;
        # a group/nghề id also matches jobs tagged with its descendants.
        if categories := params.getlist('category'):
            ids = [int(c) for c in categories if c.isdigit()]
            children = list(JobCategory.objects.filter(parent_id__in=ids).values_list('id', flat=True))
            grandchildren = list(JobCategory.objects.filter(parent_id__in=children).values_list('id', flat=True))
            qs = qs.filter(category_id__in=[*ids, *children, *grandchildren])
        # Accepts multiple ?location= values; each id may be a province or a ward.
        # A province id matches jobs at any of its wards (location.parent) or the province itself.
        if locations := params.getlist('location'):
            qs = qs.filter(Q(locations__id__in=locations) | Q(locations__parent_id__in=locations)).distinct()
        if work_type := params.get('work_type'):
            qs = qs.filter(work_type=work_type)
        if employment_type := params.get('employment_type'):
            qs = qs.filter(employment_type=employment_type)
        if experience_level := params.get('experience_level'):
            qs = qs.filter(experience_level=experience_level)
        if search := params.get('search'):
            qs = qs.filter(title__icontains=search)
        return qs.order_by('-published_at', '-created_at')


class JobDetailView(generics.RetrieveAPIView):
    serializer_class = JobSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'
    queryset = Job.objects.filter(status=Job.Status.ACTIVE).prefetch_related('locations', 'job_skills')

    def get_object(self):
        job = super().get_object()
        Job.objects.filter(pk=job.pk).update(view_count=F('view_count') + 1)
        job.refresh_from_db(fields=['view_count'])
        return job


class EmployerJobListCreateView(generics.ListCreateAPIView):
    serializer_class = JobSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return Job.objects.filter(employer=self.request.user).prefetch_related('locations').order_by('-created_at')

    def perform_create(self, serializer):
        try:
            employer_profile = self.request.user.employer_profile
        except EmployerProfile.DoesNotExist:
            raise ValidationError('Create your employer profile (company) before posting a job.')
        serializer.save(employer=self.request.user, employer_profile=employer_profile)


class EmployerJobDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = JobSerializer
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_queryset(self):
        return Job.objects.filter(employer=self.request.user).prefetch_related('locations', 'job_skills')
