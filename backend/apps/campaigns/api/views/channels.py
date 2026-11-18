from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.employers.models import RecruitmentCampaign
from apps.employers.services import ensure_recruiter_job_workspace

from ...models import CampaignChannelCost
from ...selectors import campaign_channel_report, campaign_channels_queryset
from ...services import (
    ContentQuotaExceeded,
    add_channel_cost,
    create_channel,
    delete_channel,
    delete_channel_cost,
    generate_channel_content,
    update_channel,
)
from ..serializers.channels import (
    CampaignChannelCreateSerializer,
    CampaignChannelSerializer,
    ChannelCostSerializer,
)


class CampaignScopedView(APIView):
    permission_classes = [IsEmployer]

    def campaign(self):
        ensure_recruiter_job_workspace(self.request.user)
        return get_object_or_404(
            RecruitmentCampaign.objects.filter(owner__user=self.request.user),
            public_id=self.kwargs['public_id'],
        )

    def channel(self):
        return get_object_or_404(
            campaign_channels_queryset(self.campaign()), public_id=self.kwargs['channel_id']
        )

    def channel_response(self, channel, status_code=status.HTTP_200_OK):
        annotated = campaign_channels_queryset(channel.campaign).get(pk=channel.pk)
        return Response(CampaignChannelSerializer(annotated).data, status=status_code)


class CampaignChannelListView(CampaignScopedView):
    def get(self, request, public_id):
        channels = campaign_channels_queryset(self.campaign())
        return Response(CampaignChannelSerializer(channels, many=True).data)

    def post(self, request, public_id):
        campaign = self.campaign()
        serializer = CampaignChannelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        channel = create_channel(campaign=campaign, user=request.user, **serializer.validated_data)
        return self.channel_response(channel, status.HTTP_201_CREATED)


class CampaignChannelDetailView(CampaignScopedView):
    def patch(self, request, public_id, channel_id):
        channel = self.channel()
        serializer = CampaignChannelSerializer(channel, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        channel = update_channel(channel=channel, user=request.user, **serializer.validated_data)
        return self.channel_response(channel)

    def delete(self, request, public_id, channel_id):
        delete_channel(channel=self.channel(), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignChannelContentView(CampaignScopedView):
    def post(self, request, public_id, channel_id):
        try:
            channel, fallback = generate_channel_content(channel=self.channel(), user=request.user)
        except ContentQuotaExceeded as error:
            raise Throttled(detail='Đã dùng hết lượt soạn bằng AI hôm nay.') from error
        response = self.channel_response(channel)
        response.data['fallback_reason'] = fallback
        return response


class CampaignChannelCostView(CampaignScopedView):
    def get(self, request, public_id, channel_id):
        return Response(ChannelCostSerializer(self.channel().costs.all(), many=True).data)

    def post(self, request, public_id, channel_id):
        channel = self.channel()
        serializer = ChannelCostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cost = add_channel_cost(channel=channel, user=request.user, **serializer.validated_data)
        return Response(ChannelCostSerializer(cost).data, status=status.HTTP_201_CREATED)


class CampaignChannelCostDetailView(CampaignScopedView):
    def delete(self, request, public_id, channel_id, cost_id):
        cost = get_object_or_404(CampaignChannelCost, pk=cost_id, channel=self.channel())
        delete_channel_cost(cost=cost, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignChannelReportView(CampaignScopedView):
    def get(self, request, public_id):
        return Response(campaign_channel_report(self.campaign()))
