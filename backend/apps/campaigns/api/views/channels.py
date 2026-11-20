from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_job_workspace

from ...selectors import (
    campaign_channel_report,
    campaign_channels_queryset,
    channel_costs_queryset,
    open_campaign_jobs,
    owned_campaign_queryset,
)
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
            owned_campaign_queryset(self.request.user), public_id=self.kwargs['public_id']
        )

    def channel(self):
        return get_object_or_404(
            campaign_channels_queryset(self.campaign()), public_id=self.kwargs['channel_id']
        )

    def serializer_context(self, campaign):
        return {'campaign_jobs': open_campaign_jobs(campaign)}

    def channel_response(self, channel, status_code=status.HTTP_200_OK):
        annotated = campaign_channels_queryset(channel.campaign).get(pk=channel.pk)
        serializer = CampaignChannelSerializer(
            annotated, context=self.serializer_context(channel.campaign)
        )
        return Response(serializer.data, status=status_code)


@extend_schema(tags=['campaigns'])
class CampaignChannelListView(CampaignScopedView):
    @extend_schema(
        summary='Các kênh phân phối của chiến dịch', responses=CampaignChannelSerializer(many=True)
    )
    def get(self, request, public_id):
        campaign = self.campaign()
        serializer = CampaignChannelSerializer(
            campaign_channels_queryset(campaign),
            many=True,
            context=self.serializer_context(campaign),
        )
        return Response(serializer.data)

    @extend_schema(
        summary='Thêm kênh phân phối',
        request=CampaignChannelCreateSerializer,
        responses={201: CampaignChannelSerializer},
    )
    def post(self, request, public_id):
        campaign = self.campaign()
        serializer = CampaignChannelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        channel = create_channel(campaign=campaign, user=request.user, **serializer.validated_data)
        return self.channel_response(channel, status.HTTP_201_CREATED)


@extend_schema(tags=['campaigns'])
class CampaignChannelDetailView(CampaignScopedView):
    @extend_schema(
        summary='Sửa kênh phân phối',
        request=CampaignChannelSerializer,
        responses=CampaignChannelSerializer,
    )
    def patch(self, request, public_id, channel_id):
        channel = self.channel()
        serializer = CampaignChannelSerializer(channel, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        channel = update_channel(channel=channel, user=request.user, **serializer.validated_data)
        return self.channel_response(channel)

    @extend_schema(summary='Xóa kênh phân phối', responses={204: None})
    def delete(self, request, public_id, channel_id):
        delete_channel(channel=self.channel(), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=['campaigns'],
    summary='Soạn bài của kênh bằng AI theo tin và loại link đã chọn (kèm fallback_reason)',
    request=None,
    responses=CampaignChannelSerializer,
)
class CampaignChannelContentView(CampaignScopedView):
    def post(self, request, public_id, channel_id):
        try:
            channel, fallback = generate_channel_content(channel=self.channel(), user=request.user)
        except ContentQuotaExceeded as error:
            raise Throttled(detail=_('Đã dùng hết lượt soạn bằng AI hôm nay.')) from error
        response = self.channel_response(channel)
        response.data['fallback_reason'] = fallback
        return response


@extend_schema(tags=['campaigns'])
class CampaignChannelCostView(CampaignScopedView):
    @extend_schema(summary='Chi phí đã ghi của kênh', responses=ChannelCostSerializer(many=True))
    def get(self, request, public_id, channel_id):
        costs = channel_costs_queryset(self.channel())
        return Response(ChannelCostSerializer(costs, many=True).data)

    @extend_schema(
        summary='Ghi một khoản chi cho kênh',
        request=ChannelCostSerializer,
        responses={201: ChannelCostSerializer},
    )
    def post(self, request, public_id, channel_id):
        channel = self.channel()
        serializer = ChannelCostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cost = add_channel_cost(channel=channel, user=request.user, **serializer.validated_data)
        return Response(ChannelCostSerializer(cost).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=['campaigns'], summary='Xóa một khoản chi', responses={204: None})
class CampaignChannelCostDetailView(CampaignScopedView):
    def delete(self, request, public_id, channel_id, cost_id):
        cost = get_object_or_404(channel_costs_queryset(self.channel()), pk=cost_id)
        delete_channel_cost(cost=cost, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=['campaigns'],
    summary='So sánh hiệu quả giữa các kênh',
    responses={200: OpenApiTypes.OBJECT},
)
class CampaignChannelReportView(CampaignScopedView):
    def get(self, request, public_id):
        return Response(campaign_channel_report(self.campaign()))
