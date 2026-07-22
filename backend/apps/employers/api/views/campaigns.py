from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from ...models import RecruitmentNeed
from ...selectors.campaigns import (
    campaign_detail_queryset,
    campaign_list_queryset,
    campaign_options,
    campaign_report,
    campaign_suggestions,
)
from ...services.campaigns import (
    change_campaign_status,
    create_campaign,
    create_campaign_from_need,
    update_campaign,
)
from ..serializers.campaigns import (
    CampaignStatusSerializer,
    RecruitmentCampaignSerializer,
    RecruitmentNeedSuggestionSerializer,
)


class RecruitmentCampaignListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsEmployer]
    serializer_class = RecruitmentCampaignSerializer

    def get_queryset(self):
        return campaign_list_queryset(
            self.request.user,
            status=self.request.query_params.get('status'),
            scope=self.request.query_params.get('scope'),
            q=self.request.query_params.get('q'),
        )

    def perform_create(self, serializer):
        serializer.instance = create_campaign(user=self.request.user, **serializer.validated_data)


class RecruitmentCampaignDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsEmployer]
    serializer_class = RecruitmentCampaignSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return campaign_detail_queryset(self.request.user)

    def perform_update(self, serializer):
        serializer.instance = update_campaign(
            campaign=serializer.instance, user=self.request.user, **serializer.validated_data
        )


class RecruitmentCampaignOptionsView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        return Response(
            RecruitmentCampaignSerializer(campaign_options(request.user), many=True).data
        )


class RecruitmentCampaignSuggestionsView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        return Response(
            RecruitmentNeedSuggestionSerializer(campaign_suggestions(request.user), many=True).data
        )


class RecruitmentCampaignStatusView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        campaign = get_object_or_404(campaign_detail_queryset(request.user), public_id=public_id)
        serializer = CampaignStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = change_campaign_status(
            campaign=campaign, user=request.user, status=serializer.validated_data['status']
        )
        return Response(RecruitmentCampaignSerializer(campaign).data)


class RecruitmentCampaignReportView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        campaign = get_object_or_404(campaign_detail_queryset(request.user), public_id=public_id)
        return Response(campaign_report(campaign))


class RecruitmentCampaignFromNeedView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        need = get_object_or_404(
            RecruitmentNeed.objects.select_related('position_category'),
            public_id=public_id,
            recruiter__user=request.user,
        )
        campaign = create_campaign_from_need(need=need, user=request.user)
        return Response(
            RecruitmentCampaignSerializer(campaign).data, status=status.HTTP_201_CREATED
        )
