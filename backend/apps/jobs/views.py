from datetime import timedelta

from django.db.models import F, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

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


class JobStatsView(APIView):
    """Aggregate stats for the homepage market dashboard (public)."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary='Thống kê thị trường việc làm (dashboard trang chủ)',
        responses=inline_serializer(
            'JobStats',
            fields={
                'active_jobs': serializers.IntegerField(),
                'companies': serializers.IntegerField(),
                'new_jobs_24h': serializers.IntegerField(),
                'growth': inline_serializer('JobStatsGrowth', many=True, fields={
                    'date': serializers.CharField(),
                    'count': serializers.IntegerField(),
                }),
                'demand': inline_serializer('JobStatsDemand', many=True, fields={
                    'name': serializers.CharField(),
                    'count': serializers.IntegerField(),
                }),
                'latest_jobs': inline_serializer('JobStatsLatest', many=True, fields={
                    'public_id': serializers.CharField(),
                    'slug': serializers.CharField(),
                    'title': serializers.CharField(),
                    'company_name': serializers.CharField(),
                    'location_name': serializers.CharField(),
                }),
            },
        ),
        tags=['jobs'],
    )
    def get(self, request):
        now = timezone.now()
        active = Job.objects.filter(status=Job.Status.ACTIVE).annotate(
            published=Coalesce('published_at', 'created_at')
        )

        active_jobs = active.count()
        companies = active.values('employer_profile').distinct().count()
        new_jobs_24h = active.filter(published__gte=now - timedelta(days=1)).count()

        # Growth: cumulative active jobs published up to the end of each of the last 7 days.
        growth = []
        for offset in range(6, -1, -1):
            day = (now - timedelta(days=offset)).date()
            cutoff = timezone.make_aware(
                timezone.datetime(day.year, day.month, day.day, 23, 59, 59)
            ) if timezone.is_naive(now) else now.replace(
                year=day.year, month=day.month, day=day.day, hour=23, minute=59, second=59, microsecond=0
            )
            growth.append({
                'date': day.strftime('%d/%m'),
                'count': active.filter(published__lte=cutoff).count(),
            })

        # Demand: active jobs per top-level category (rolled up from nghề/vị trí levels).
        demand = []
        for top in JobCategory.objects.filter(parent__isnull=True, status=JobCategory.Status.ACTIVE):
            children = JobCategory.objects.filter(parent=top).values_list('id', flat=True)
            grandchildren = JobCategory.objects.filter(parent_id__in=children).values_list('id', flat=True)
            ids = [top.id, *children, *grandchildren]
            count = active.filter(category_id__in=ids).count()
            if count:
                demand.append({'name': top.name, 'count': count})
        demand.sort(key=lambda d: d['count'], reverse=True)

        latest = (
            active.select_related('employer_profile').prefetch_related('locations')
            .order_by('-published')[:10]
        )
        latest_jobs = [{
            'public_id': j.public_id,
            'slug': j.slug,
            'title': j.title,
            'company_name': j.employer_profile.company_name,
            'location_name': (j.locations.first().name if j.locations.exists() else ''),
        } for j in latest]

        return Response({
            'active_jobs': active_jobs,
            'companies': companies,
            'new_jobs_24h': new_jobs_24h,
            'growth': growth,
            'demand': demand[:6],
            'latest_jobs': latest_jobs,
        })


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
