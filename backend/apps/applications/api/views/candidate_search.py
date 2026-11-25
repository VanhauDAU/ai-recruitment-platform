from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate, IsEmployer
from apps.employers.services import ensure_recruiter_candidate_data_access
from apps.matching.services import ProfileFilters
from common.api.throttling import with_account_write_cap

from ...selectors import (
    candidate_search_invitations_queryset,
    recruiter_talent_pool_jobs_queryset,
)
from ...services import (
    candidate_detail,
    invite_candidate,
    respond_to_search_invitation,
    search_candidates,
)
from ..serializers.candidate_search import (
    CandidateSearchInvitationResponseSerializer,
    CandidateSearchInvitationSerializer,
    CandidateSearchInviteSerializer,
    CandidateSearchQuerySerializer,
)

LIST_PARAMS = ('skills', 'all_keywords', 'any_keywords', 'none_keywords')


def _job(request, public_id):
    """Tin đang công khai của chính nhà tuyển dụng: chỉ tìm và mời cho tin đang tuyển."""
    ensure_recruiter_candidate_data_access(request.user)
    jobs = recruiter_talent_pool_jobs_queryset(request.user, public_only=True)
    return get_object_or_404(jobs, public_id=public_id)


def _query(request):
    data = request.query_params.dict()
    for key in LIST_PARAMS:
        if key in request.query_params:
            data[key] = [
                value.strip()
                for value in request.query_params.get(key, '').split(',')
                if value.strip()
            ]
    serializer = CandidateSearchQuerySerializer(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


@extend_schema(
    tags=['applications'],
    summary='Tìm CV: ứng viên đang bật tìm kiếm, xếp theo mức phù hợp với một tin',
    description=(
        'Kết quả ẩn danh: mã ứng viên, chức danh, kinh nghiệm theo chức danh và mốc thời gian, '
        'học vấn, cấp bậc, ngoại ngữ, vị trí và tỉnh/thành mong muốn, kỹ năng trùng với tin, điểm '
        'và mức phù hợp. Không có tên, liên hệ, tệp CV hay tên công ty.'
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
        count, rows = search_candidates(
            request.user,
            job,
            filters=ProfileFilters(
                skill_ids=tuple(params['skills']),
                min_months=params['min_months'],
                max_months=params['max_months'],
                education=params['education'],
                position_level=params['position_level'],
                language=params['language'],
                language_level=params['language_level'],
                keyword=params['q'].strip(),
                title=params['title'].strip(),
                school=params['school'].strip(),
                all_keywords=tuple(params['all_keywords']),
                any_keywords=tuple(params['any_keywords']),
                none_keywords=tuple(params['none_keywords']),
            ),
            province_id=params['province'],
            category_id=params['category'],
            page=params['page'],
            page_size=params['page_size'],
        )
        return Response({'count': count, 'page_size': params['page_size'], 'results': rows})


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

    # Cùng tiền tố URL với danh sách: đặt tên thao tác riêng để schema không trùng.
    @extend_schema(operation_id='employer_candidate_search_detail')
    def get(self, request, ref):
        job = _job(request, request.query_params.get('job', ''))
        return Response(candidate_detail(request.user, job, ref, request=request))


@extend_schema(
    tags=['applications'],
    summary='Tìm CV: gửi lời mời kết nối về một tin đang tuyển cho một ứng viên',
    request=CandidateSearchInviteSerializer,
    responses={204: None},
)
class RecruiterCandidateSearchInviteView(APIView):
    permission_classes = [IsEmployer]
    throttle_classes = with_account_write_cap(ScopedRateThrottle)
    throttle_scope = 'candidate_search_invite'

    def post(self, request, ref):
        serializer = CandidateSearchInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite_candidate(request.user, _job(request, serializer.validated_data['job']), ref)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=['applications'], summary='Lời mời kết nối của nhà tuyển dụng gửi cho tôi')
class CandidateSearchInvitationListView(generics.ListAPIView):
    permission_classes = [IsCandidate]
    serializer_class = CandidateSearchInvitationSerializer

    def get_queryset(self):
        return candidate_search_invitations_queryset(self.request.user)


@extend_schema(
    tags=['applications'],
    summary='Đồng ý hoặc từ chối một lời mời kết nối',
    request=CandidateSearchInvitationResponseSerializer,
    responses={200: CandidateSearchInvitationSerializer},
)
class CandidateSearchInvitationRespondView(APIView):
    permission_classes = [IsCandidate]

    def post(self, request, public_id):
        serializer = CandidateSearchInvitationResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = respond_to_search_invitation(
            candidate=request.user,
            public_id=public_id,
            accept=serializer.validated_data['accept'],
        )
        return Response(
            CandidateSearchInvitationSerializer(invitation, context={'request': request}).data
        )
