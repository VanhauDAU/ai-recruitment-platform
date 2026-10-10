from time import perf_counter

from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.metrics import record_metric

from ...selectors.campaigns import (
    CampaignJobPerformanceScopeNotFound,
    attach_campaign_candidate_previews,
    campaign_activity_queryset,
    campaign_detail_queryset,
    campaign_job_performance,
    campaign_list_queryset,
    campaign_options,
    campaign_pause_impact,
    campaign_report,
    owned_campaign_queryset,
)
from ...services import ensure_recruiter_job_workspace
from ...services.campaigns import (
    change_campaign_status,
    create_campaign,
    update_campaign,
)
from ..serializers.campaigns import (
    CampaignActivitySerializer,
    CampaignPerformanceQuerySerializer,
    CampaignStatusSerializer,
    RecruitmentCampaignSerializer,
)


class EmployerWorkspaceReadMixin:
    """Authoritatively gate recruiter workspace reads and cache their state."""

    def employer_workspace_readiness(self):
        readiness = getattr(self, '_employer_workspace_readiness', None)
        if readiness is None:
            _, readiness = ensure_recruiter_job_workspace(self.request.user)
            self._employer_workspace_readiness = readiness
        return readiness


class RecruitmentCampaignListCreateView(EmployerWorkspaceReadMixin, generics.ListCreateAPIView):
    permission_classes = [IsEmployer]
    serializer_class = RecruitmentCampaignSerializer

    def get_queryset(self):
        self.employer_workspace_readiness()
        return campaign_list_queryset(
            self.request.user,
            status=self.request.query_params.get('status'),
            scope=self.request.query_params.get('scope'),
            q=self.request.query_params.get('q'),
            ordering=self.request.query_params.get('ordering'),
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            if self.employer_workspace_readiness()['candidate_data_access']:
                attach_campaign_candidate_previews(page)
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        campaigns = list(queryset)
        if self.employer_workspace_readiness()['candidate_data_access']:
            attach_campaign_candidate_previews(campaigns)
        serializer = self.get_serializer(campaigns, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.instance = create_campaign(user=self.request.user, **serializer.validated_data)


class RecruitmentCampaignDetailView(EmployerWorkspaceReadMixin, generics.RetrieveUpdateAPIView):
    permission_classes = [IsEmployer]
    serializer_class = RecruitmentCampaignSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        self.employer_workspace_readiness()
        return campaign_detail_queryset(self.request.user)

    def perform_update(self, serializer):
        serializer.instance = update_campaign(
            campaign=serializer.instance, user=self.request.user, **serializer.validated_data
        )


class RecruitmentCampaignOptionsView(EmployerWorkspaceReadMixin, APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        self.employer_workspace_readiness()
        return Response(
            RecruitmentCampaignSerializer(campaign_options(request.user), many=True).data
        )


class RecruitmentCampaignStatusView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        campaign = get_object_or_404(campaign_detail_queryset(request.user), public_id=public_id)
        serializer = CampaignStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = change_campaign_status(
            campaign=campaign,
            user=request.user,
            status=serializer.validated_data['status'],
            confirmation_code=serializer.validated_data.get('confirmation_code', ''),
        )
        return Response(RecruitmentCampaignSerializer(campaign).data)


class RecruitmentCampaignPauseImpactView(EmployerWorkspaceReadMixin, APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        self.employer_workspace_readiness()
        campaign = get_object_or_404(
            owned_campaign_queryset(request.user),
            public_id=public_id,
        )
        return Response(campaign_pause_impact(campaign))


class RecruitmentCampaignActivityView(EmployerWorkspaceReadMixin, generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = CampaignActivitySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['candidate_data_access'] = self.employer_workspace_readiness()[
            'candidate_data_access'
        ]
        return context

    def get_queryset(self):
        self.employer_workspace_readiness()
        campaign = get_object_or_404(
            owned_campaign_queryset(self.request.user),
            public_id=self.kwargs['public_id'],
        )
        return campaign_activity_queryset(
            campaign,
            group=self.request.query_params.get('group'),
        )


class RecruitmentCampaignReportView(EmployerWorkspaceReadMixin, APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        self.employer_workspace_readiness()
        campaign = get_object_or_404(owned_campaign_queryset(request.user), public_id=public_id)
        return Response(campaign_report(campaign))


class RecruitmentCampaignJobPerformanceView(EmployerWorkspaceReadMixin, APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        self.employer_workspace_readiness()
        started_at = perf_counter()
        campaign = get_object_or_404(owned_campaign_queryset(request.user), public_id=public_id)
        serializer = CampaignPerformanceQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            result = campaign_job_performance(
                campaign,
                days=serializer.validated_data['days'],
                job_public_id=serializer.validated_data.get('job'),
            )
        except CampaignJobPerformanceScopeNotFound as error:
            raise Http404 from error
        record_metric(
            'campaign_job_performance_duration_ms',
            round((perf_counter() - started_at) * 1000, 2),
            status='success',
        )
        return Response(result)
