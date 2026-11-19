"""The candidate's saved-job list."""

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.response import Response

from apps.accounts.api.permissions import IsCandidate

from ...selectors import candidate_saved_job_rows, candidate_saved_jobs_queryset
from ...selectors.verification_badge import prime_badge_cache
from ...services import save_job_for_candidate
from ..serializers import SavedJobSerializer


@extend_schema_view(
    list=extend_schema(summary='Tin đã lưu của ứng viên'),
    create=extend_schema(summary='Lưu tin tuyển dụng'),
)
@extend_schema(tags=['jobs'])
class SavedJobListCreateView(generics.ListCreateAPIView):
    """GET: toàn bộ tin đã lưu của ứng viên. POST {"job": "jb_xxx"}: lưu tin.

    Không phân trang: frontend cần trọn bộ id đã lưu để tô trạng thái trái tim
    trên mọi job card và đếm badge trên nút nổi.
    """

    serializer_class = SavedJobSerializer
    permission_classes = [IsCandidate]
    pagination_class = None

    def get_queryset(self):
        return candidate_saved_jobs_queryset(self.request.user)

    def list(self, request, *args, **kwargs):
        saved_jobs = list(self.filter_queryset(self.get_queryset()))
        context = self.get_serializer_context()
        prime_badge_cache(
            context,
            {(saved.job.company_id, saved.job.posted_by_id) for saved in saved_jobs},
        )
        return Response(self.get_serializer(saved_jobs, many=True, context=context).data)

    def perform_create(self, serializer):
        serializer.instance = save_job_for_candidate(
            candidate=self.request.user, job=serializer.validated_data['job']
        )


@extend_schema(
    summary='Bỏ lưu tin tuyển dụng',
    responses={204: None},
    tags=['jobs'],
)
class SavedJobDestroyView(generics.DestroyAPIView):
    """DELETE /jobs/saved/<job_public_id>/ — bỏ lưu tin."""

    permission_classes = [IsCandidate]
    lookup_field = 'job__public_id'
    lookup_url_kwarg = 'public_id'

    def get_queryset(self):
        return candidate_saved_job_rows(self.request.user)
