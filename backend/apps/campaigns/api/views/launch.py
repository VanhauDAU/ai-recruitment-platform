from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.employers.models import RecruitmentCampaign
from apps.employers.services import ensure_recruiter_job_workspace

from ...services import campaign_launch_overview, launch_campaign, save_launch_selection
from ..serializers.launch import LaunchRequestSerializer, LaunchSelectionSerializer


class CampaignLaunchView(APIView):
    """Wizard job and review steps: read the checklist, pick jobs, go live."""

    permission_classes = [IsEmployer]

    def _campaign(self, request, public_id):
        ensure_recruiter_job_workspace(request.user)
        return get_object_or_404(
            RecruitmentCampaign.objects.filter(owner__user=request.user), public_id=public_id
        )

    def get(self, request, public_id):
        campaign = self._campaign(request, public_id)
        return Response(campaign_launch_overview(campaign, request.user))

    def put(self, request, public_id):
        campaign = self._campaign(request, public_id)
        serializer = LaunchSelectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = save_launch_selection(
            campaign=campaign, user=request.user, **serializer.validated_data
        )
        return Response(campaign_launch_overview(campaign, request.user))

    def post(self, request, public_id):
        campaign = self._campaign(request, public_id)
        serializer = LaunchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = launch_campaign(
            campaign=campaign, user=request.user, **serializer.validated_data
        )
        return Response({'public_id': campaign.public_id, 'status': campaign.status})
