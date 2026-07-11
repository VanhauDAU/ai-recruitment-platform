from django.db.models import F
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate, IsEmployer
from apps.employers.models import RecruiterProfile

from ...models import Benefit, Job, JobCategory, Language, SavedJob
from common.db.search import fold_accents, search_q

from ...selectors.listing import build_job_list_queryset
from ..serializers import (
    BenefitSerializer,
    EmployerJobSerializer,
    JobCategorySerializer,
    JobDetailSerializer,
    JobSerializer,
    LanguageSerializer,
    SavedJobSerializer,
)
from ...selectors.stats import build_job_stats


class JobCategoryListView(generics.ListAPIView):
    serializer_class = JobCategorySerializer
    permission_classes = [permissions.AllowAny]

    def paginate_queryset(self, queryset):
        # Search pickers need the whole bounded taxonomy. Keep normal pagination
        # as the API default for other consumers.
        if self.request.query_params.get('all') in {'1', 'true'}:
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        queryset = JobCategory.objects.filter(status=JobCategory.Status.ACTIVE)
        if category_type := self.request.query_params.get('category_type'):
            queryset = queryset.filter(category_type=category_type)
        return queryset


class BenefitListView(generics.ListAPIView):
    serializer_class = BenefitSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = Benefit.objects.filter(is_active=True)


class LanguageListView(generics.ListAPIView):
    serializer_class = LanguageSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = Language.objects.filter(is_active=True)
