from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_candidate_data_access
from apps.matching.services import ProfileFilters

from ...selectors import recruiter_talent_pool_jobs_queryset
from ...services import candidate_detail, invite_candidate, search_candidates
from ..serializers.candidate_search import (
    CandidateSearchInviteSerializer,
    CandidateSearchQuerySerializer,
)

PAGE_SIZE = 20


def _job(request, public_id):
    """Tin đang công khai của chính nhà tuyển dụng: chỉ tìm và mời cho tin đang tuyển."""
    ensure_recruiter_candidate_data_access(request.user)
    jobs = recruiter_talent_pool_jobs_queryset(request.user, public_only=True)
    return get_object_or_404(jobs, public_id=public_id)


def _query(request):
    data = request.query_params.dict()
    if 'skills' in request.query_params:
        data['skills'] = [
            value for value in request.query_params.get('skills', '').split(',') if value
        ]
    serializer = CandidateSearchQuerySerializer(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


@extend_schema(
    tags=['applications'],
    summary='Tìm CV: ứng viên đang bật tìm kiếm, xếp theo mức phù hợp với một tin',
    description=(
        'Kết quả ẩn danh: mã ứng viên, chức danh, kinh nghiệm, học vấn, cấp bậc, ngoại ngữ, kỹ '
        'năng trùng với tin, điểm và mức phù hợp. Không có tên, liên hệ, tệp CV hay tên công ty.'
    ),
    parameters=[CandidateSearchQuerySerializer],
    responses={200: OpenApiTypes.OBJECT},
)
class RecruiterCandidateSearchView(APIView):
    permission_classes = [IsEmployer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'candidate_search'

    def get(self, request):
        params = _query(request)
        job = _job(request, params['job'])
        rows = search_candidates(
            request.user,
            job,
            filters=ProfileFilters(
                skill_ids=tuple(params['skills']),
                min_months=params['min_months'],
                education=params['education'],
                language=params['language'],
                keyword=params['q'].strip(),
            ),
            province_id=params['province'],
        )
        start = (params['page'] - 1) * PAGE_SIZE
        return Response(
            {'count': len(rows), 'page_size': PAGE_SIZE, 'results': rows[start : start + PAGE_SIZE]}
        )


@extend_schema(
    tags=['applications'],
    summary='Tìm CV: hồ sơ trích xuất ẩn danh và mức phù hợp chi tiết của một ứng viên',
    description='Mỗi lần mở được ghi `CvAccessLog` kênh `recruiter_search`.',
    parameters=[OpenApiParameter('job', str, required=True)],
    responses={200: OpenApiTypes.OBJECT},
)
class RecruiterCandidateSearchDetailView(APIView):
    permission_classes = [IsEmployer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'candidate_search'

    def get(self, request, ref):
        job = _job(request, request.query_params.get('job', ''))
        return Response(candidate_detail(request.user, job, ref, request=request))


@extend_schema(
    tags=['applications'],
    summary='Tìm CV: mời một ứng viên ứng tuyển vào một tin đang tuyển',
    request=CandidateSearchInviteSerializer,
    responses={204: None},
)
class RecruiterCandidateSearchInviteView(APIView):
    permission_classes = [IsEmployer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'candidate_search_invite'

    def post(self, request, ref):
        serializer = CandidateSearchInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite_candidate(request.user, _job(request, serializer.validated_data['job']), ref)
        return Response(status=status.HTTP_204_NO_CONTENT)
