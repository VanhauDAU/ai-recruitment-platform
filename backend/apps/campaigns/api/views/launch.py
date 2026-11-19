from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_job_workspace

from ...selectors import owned_campaign_queryset
from ...services import campaign_launch_overview, launch_campaign, save_launch_selection
from ..serializers.launch import LaunchRequestSerializer, LaunchSelectionSerializer


@extend_schema(tags=['campaigns'])
class CampaignLaunchView(APIView):
    """Wizard job and review steps: read the checklist, pick jobs, go live."""

    permission_classes = [IsEmployer]

    def _campaign(self, request, public_id):
        ensure_recruiter_job_workspace(request.user)
        return get_object_or_404(owned_campaign_queryset(request.user), public_id=public_id)

    @extend_schema(summary='Danh sách kiểm tra trước khi phát hành', responses=OpenApiTypes.OBJECT)
    def get(self, request, public_id):
        campaign = self._campaign(request, public_id)
        return Response(campaign_launch_overview(campaign, request.user))

    @extend_schema(
        summary='Chọn tin cho chiến dịch',
        request=LaunchSelectionSerializer,
        responses=OpenApiTypes.OBJECT,
    )
    def put(self, request, public_id):
        campaign = self._campaign(request, public_id)
        serializer = LaunchSelectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = save_launch_selection(
            campaign=campaign, user=request.user, **serializer.validated_data
        )
        return Response(campaign_launch_overview(campaign, request.user))

    @extend_schema(
        summary='Phát hành chiến dịch',
        request=LaunchRequestSerializer,
        responses=inline_serializer(
            'CampaignLaunchResult',
            {'public_id': serializers.CharField(), 'status': serializers.CharField()},
        ),
    )
    def post(self, request, public_id):
        campaign = self._campaign(request, public_id)
        serializer = LaunchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = launch_campaign(
            campaign=campaign, user=request.user, **serializer.validated_data
        )
        return Response({'public_id': campaign.public_id, 'status': campaign.status})
