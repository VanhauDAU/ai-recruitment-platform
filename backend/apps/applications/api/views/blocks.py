from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_candidate_data_access

from ...selectors import (
    employer_application_queryset,
    recruiter_candidate_blocks_queryset,
    recruiter_is_company_owner,
)
from ...services import block_candidate, lift_candidate_block
from ..serializers.blocks import CandidateBlockCreateSerializer, CandidateBlockSerializer


def _block_context(user):
    return {'user': user, 'is_company_owner': recruiter_is_company_owner(user)}


@extend_schema(tags=['applications'])
class RecruiterCandidateBlockListCreateView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = CandidateBlockSerializer

    def get_queryset(self):
        ensure_recruiter_candidate_data_access(self.request.user)
        return recruiter_candidate_blocks_queryset(self.request.user)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), **_block_context(self.request.user)}

    @extend_schema(
        summary='Chặn ứng viên ứng tuyển vào các tin của công ty',
        request=CandidateBlockCreateSerializer,
        responses={201: CandidateBlockSerializer},
    )
    def post(self, request):
        ensure_recruiter_candidate_data_access(request.user)
        serializer = CandidateBlockCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        application = get_object_or_404(
            employer_application_queryset(request.user), public_id=data['application_public_id']
        )
        block = block_candidate(
            application,
            recruiter=request.user,
            reason=data['reason'],
            note=data.get('note', ''),
            duration_days=data.get('duration_days'),
            reject_pending=data['reject_pending'],
        )
        return Response(
            CandidateBlockSerializer(block, context=_block_context(request.user)).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(
    tags=['applications'],
    summary='Gỡ chặn ứng viên',
    request=None,
    responses={200: CandidateBlockSerializer},
)
class RecruiterCandidateBlockLiftView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        ensure_recruiter_candidate_data_access(request.user)
        block = lift_candidate_block(recruiter=request.user, block_public_id=public_id)
        return Response(CandidateBlockSerializer(block, context=_block_context(request.user)).data)
