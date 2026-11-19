from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate, IsEmployer
from apps.employers.services import ensure_recruiter_candidate_data_access
from apps.jobs.models import Job
from apps.jobs.selectors.listing import publicly_available_job_filter

from ...models import TalentPoolEntry
from ...selectors import (
    candidate_talent_pool_queryset,
    employer_application_queryset,
    recruiter_talent_pool_queryset,
    talent_suggestions_for_job,
)
from ...services import (
    TalentPoolConflict,
    add_to_talent_pool,
    invite_to_apply,
    remove_from_talent_pool,
    update_talent_pool_entry,
    withdraw_from_talent_pool,
)
from ..serializers.talent_pool import (
    CandidateTalentPoolSerializer,
    TalentPoolAddSerializer,
    TalentPoolEntrySerializer,
    TalentPoolInviteSerializer,
    TalentPoolUpdateSerializer,
    TalentSuggestionSerializer,
)


def _entry(request, public_id):
    ensure_recruiter_candidate_data_access(request.user)
    return get_object_or_404(recruiter_talent_pool_queryset(request.user), public_id=public_id)


@extend_schema(tags=['applications-v2'])
class RecruiterTalentPoolListCreateView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = TalentPoolEntrySerializer

    def get_queryset(self):
        ensure_recruiter_candidate_data_access(self.request.user)
        params = self.request.query_params
        return recruiter_talent_pool_queryset(
            self.request.user, q=params.get('q', '').strip(), tag=params.get('tag', '').strip()
        )

    @extend_schema(
        summary='Lưu ứng viên vào kho tiềm năng (ứng viên được thông báo)',
        request=TalentPoolAddSerializer,
        responses={201: TalentPoolEntrySerializer},
    )
    def post(self, request):
        ensure_recruiter_candidate_data_access(request.user)
        serializer = TalentPoolAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = get_object_or_404(
            employer_application_queryset(request.user).select_related('job__company', 'candidate'),
            public_id=serializer.validated_data['application_public_id'],
        )
        try:
            entry = add_to_talent_pool(
                application,
                recruiter=request.user,
                note=serializer.validated_data.get('note', ''),
                tags=serializer.validated_data.get('tags', []),
            )
        except TalentPoolConflict as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(TalentPoolEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=['applications-v2'])
class RecruiterTalentPoolEntryView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Sửa ghi chú, nhãn',
        request=TalentPoolUpdateSerializer,
        responses=TalentPoolEntrySerializer,
    )
    def patch(self, request, public_id):
        entry = _entry(request, public_id)
        serializer = TalentPoolUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        entry = update_talent_pool_entry(entry, **serializer.validated_data)
        return Response(TalentPoolEntrySerializer(entry).data)

    @extend_schema(summary='Bỏ ứng viên khỏi kho')
    def delete(self, request, public_id):
        remove_from_talent_pool(_entry(request, public_id))
        return Response(status=status.HTTP_204_NO_CONTENT)


def _recruiter_job(request, public_id, *, public_only=False):
    jobs = Job.objects.select_related('company').filter(posted_by=request.user)
    if public_only:
        jobs = jobs.filter(publicly_available_job_filter())
    return get_object_or_404(jobs, public_id=public_id)


@extend_schema(
    tags=['applications-v2'],
    summary='Người trong kho phù hợp với một tin (xếp theo độ tương đồng)',
    parameters=[OpenApiParameter('job', str, required=True)],
    responses={200: TalentSuggestionSerializer(many=True)},
)
class RecruiterTalentSuggestionView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        ensure_recruiter_candidate_data_access(request.user)
        job = _recruiter_job(request, request.query_params.get('job', ''))
        suggestions = talent_suggestions_for_job(request.user, job)
        return Response(TalentSuggestionSerializer(suggestions, many=True).data)


@extend_schema(
    tags=['applications-v2'],
    summary='Mời ứng viên trong kho ứng tuyển một tin (mỗi tin một lần)',
    request=TalentPoolInviteSerializer,
    responses={204: None},
)
class RecruiterTalentPoolInviteView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        entry = _entry(request, public_id)
        serializer = TalentPoolInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = _recruiter_job(request, serializer.validated_data['job_public_id'], public_only=True)
        try:
            invite_to_apply(entry, job=job)
        except TalentPoolConflict as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=['applications-v2'], summary='Các NTD đang lưu hồ sơ của tôi')
class CandidateTalentPoolListView(generics.ListAPIView):
    permission_classes = [IsCandidate]
    serializer_class = CandidateTalentPoolSerializer

    def get_queryset(self):
        return candidate_talent_pool_queryset(self.request.user)


@extend_schema(tags=['applications-v2'], summary='Rút hồ sơ khỏi kho của một NTD', request=None)
class CandidateTalentPoolWithdrawView(APIView):
    permission_classes = [IsCandidate]

    def post(self, request, public_id):
        try:
            withdraw_from_talent_pool(candidate=request.user, entry_public_id=public_id)
        except TalentPoolEntry.DoesNotExist as error:
            raise Http404 from error
        return Response(status=status.HTTP_204_NO_CONTENT)
