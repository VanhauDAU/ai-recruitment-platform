from time import perf_counter

from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from apps.campaigns.api.serializers.campaigns import (
    CampaignActivitySerializer,
    CampaignPerformanceQuerySerializer,
    CampaignStatusSerializer,
    RecruitmentCampaignSerializer,
)
from apps.campaigns.selectors.campaigns import (
    CampaignJobPerformanceScopeNotFound,
    attach_campaign_candidate_previews,
    campaign_activity_queryset,
    campaign_detail_queryset,
    campaign_job_performance,
    campaign_list_counts,
    campaign_list_queryset,
    campaign_options,
    campaign_pause_impact,
    campaign_report,
    owned_campaign_queryset,
)
from apps.campaigns.services.campaigns import (
    change_campaign_status,
    create_campaign,
    update_campaign,
)
from apps.employers.services import ensure_recruiter_job_workspace
from common.metrics import record_metric


class EmployerWorkspaceReadMixin:
    """Authoritatively gate recruiter workspace reads and cache their state."""

    def employer_workspace_readiness(self):
        readiness = getattr(self, '_employer_workspace_readiness', None)
        if readiness is None:
            _recruiter, readiness = ensure_recruiter_job_workspace(self.request.user)
            self._employer_workspace_readiness = readiness
        return readiness


@extend_schema_view(
    list=extend_schema(summary='Chiến dịch của NTD (kèm status_counts khi phân trang)'),
    create=extend_schema(summary='Tạo chiến dịch'),
)
@extend_schema(tags=['campaigns'])
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
            response = self.get_paginated_response(serializer.data)
            status_counts, attention_counts = campaign_list_counts(
                request.user,
                status=request.query_params.get('status'),
                q=request.query_params.get('q'),
            )
            response.data['status_counts'] = status_counts
            response.data['attention_counts'] = attention_counts
            return response

        campaigns = list(queryset)
        if self.employer_workspace_readiness()['candidate_data_access']:
            attach_campaign_candidate_previews(campaigns)
        serializer = self.get_serializer(campaigns, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        campaign = create_campaign(user=self.request.user, **serializer.validated_data)
        serializer.instance = campaign_detail_queryset(self.request.user).get(pk=campaign.pk)


@extend_schema(tags=['campaigns'])
class RecruitmentCampaignDetailView(EmployerWorkspaceReadMixin, generics.RetrieveUpdateAPIView):
    permission_classes = [IsEmployer]
    serializer_class = RecruitmentCampaignSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        self.employer_workspace_readiness()
        return campaign_detail_queryset(self.request.user)

    def perform_update(self, serializer):
        campaign = update_campaign(
            campaign=serializer.instance, user=self.request.user, **serializer.validated_data
        )
        serializer.instance = campaign_detail_queryset(self.request.user).get(pk=campaign.pk)


@extend_schema(
    tags=['campaigns'],
    summary='Chiến dịch còn chọn được khi gắn tin',
    responses=RecruitmentCampaignSerializer(many=True),
)
class RecruitmentCampaignOptionsView(EmployerWorkspaceReadMixin, APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        self.employer_workspace_readiness()
        return Response(
            RecruitmentCampaignSerializer(campaign_options(request.user), many=True).data
        )


@extend_schema(
    tags=['campaigns'],
    summary='Đổi trạng thái chiến dịch',
    request=CampaignStatusSerializer,
    responses=RecruitmentCampaignSerializer,
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


@extend_schema(
    tags=['campaigns'],
    summary='Ảnh hưởng của việc tạm dừng chiến dịch',
    responses=OpenApiTypes.OBJECT,
)
class RecruitmentCampaignPauseImpactView(EmployerWorkspaceReadMixin, APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        self.employer_workspace_readiness()
        campaign = get_object_or_404(
            owned_campaign_queryset(request.user),
            public_id=public_id,
        )
        return Response(campaign_pause_impact(campaign))


@extend_schema(tags=['campaigns'], summary='Nhật ký hoạt động của chiến dịch')
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


@extend_schema(tags=['campaigns'], summary='Báo cáo chiến dịch', responses=OpenApiTypes.OBJECT)
class RecruitmentCampaignReportView(EmployerWorkspaceReadMixin, APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        self.employer_workspace_readiness()
        campaign = get_object_or_404(owned_campaign_queryset(request.user), public_id=public_id)
        return Response(campaign_report(campaign))


@extend_schema(
    tags=['campaigns'],
    summary='Hiệu quả theo tin trong chiến dịch',
    parameters=[CampaignPerformanceQuerySerializer],
    responses=OpenApiTypes.OBJECT,
)
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
