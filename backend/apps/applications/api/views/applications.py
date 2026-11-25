"""V2 candidate submission and recruiter immutable-snapshot reads."""

from django.db import IntegrityError
from django.http import Http404
from django.utils.translation import gettext as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate, IsEmployer
from apps.applications.api.serializers.applications import (
    CandidateApplicationCreateSerializer,
    CandidateApplicationSerializer,
    RecruiterApplicationSnapshotSerializer,
)
from apps.applications.models import Application
from apps.applications.selectors import (
    candidate_applications_queryset,
    recruiter_application_snapshot_queryset,
)
from apps.applications.services import (
    ApplicationNotAllowed,
    ApplicationNotFound,
    application_rules,
    create_application_record,
    open_application_snapshot,
    request_recruiter_reminder,
    withdraw_application,
)
from apps.campaigns.services import resolve_campaign_attribution
from apps.employers.services import ensure_recruiter_candidate_data_access
from common.api.throttling import WriteScopedRateThrottle, with_default_throttles


@extend_schema_view(
    list=extend_schema(summary='Hồ sơ ứng tuyển của ứng viên'),
    create=extend_schema(
        summary='Ứng viên nộp hồ sơ (snapshot CV bất biến)',
        request=CandidateApplicationCreateSerializer,
        responses={201: CandidateApplicationSerializer},
    ),
)
@extend_schema(tags=['applications'])
class CandidateApplicationListCreateView(generics.ListCreateAPIView):
    throttle_classes = with_default_throttles(WriteScopedRateThrottle)
    throttle_scope = 'application_create'
    permission_classes = [IsCandidate]

    def get_queryset(self):
        return candidate_applications_queryset(self.request.user)

    def get_serializer_class(self):
        return (
            CandidateApplicationCreateSerializer
            if self.request.method == 'POST'
            else CandidateApplicationSerializer
        )

    def create(self, request, *args, **kwargs):
        if not request.user.email_verified:
            raise ValidationError({'detail': 'Verify your email before applying for a job.'})
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        channel = resolve_campaign_attribution(
            job=serializer.validated_data['job'],
            ref=serializer.validated_data.get('campaign_ref', ''),
        )
        try:
            application = create_application_record(
                candidate=request.user,
                job=serializer.validated_data['job'],
                cv=serializer.validated_data['cv'],
                source_version=serializer.validated_data['version'],
                cover_letter=serializer.validated_data.get('cover_letter', ''),
                preferred_locations=serializer.validated_data.get('preferred_locations', ()),
                allow_ai_analysis=serializer.validated_data.get('allow_ai_analysis', False),
                data_processing_consent=serializer.validated_data['data_processing_consent'],
                contact_name=serializer.validated_data['contact_name'],
                contact_email=serializer.validated_data['contact_email'],
                contact_phone=serializer.validated_data['contact_phone'],
                campaign_channel=channel,
            )
        except ApplicationNotAllowed as error:
            raise ValidationError({'job_public_id': str(error)}) from error
        except ValueError as error:
            raise ValidationError({'version_public_id': str(error)}) from error
        except IntegrityError:
            return Response(
                {'detail': _('Không thể gửi thêm hồ sơ ứng tuyển vào lúc này.')},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            CandidateApplicationSerializer(application).data, status=status.HTTP_201_CREATED
        )


def _candidate_application_response(action):
    try:
        application = action()
    except ApplicationNotFound as error:
        raise Http404 from error
    except ApplicationNotAllowed as error:
        raise ValidationError({'detail': str(error)}) from error
    return Response(CandidateApplicationSerializer(application).data)


@extend_schema(
    summary='Ứng viên rút hồ sơ chưa có kết quả',
    request=None,
    responses={200: CandidateApplicationSerializer},
    tags=['applications'],
)
class CandidateApplicationWithdrawView(APIView):
    permission_classes = [IsCandidate]

    def post(self, request, public_id):
        return _candidate_application_response(
            lambda: withdraw_application(candidate=request.user, public_id=public_id)
        )


@extend_schema(
    summary='Ứng viên nhờ ProCV nhắc nhà tuyển dụng phản hồi hồ sơ',
    request=None,
    responses={200: CandidateApplicationSerializer},
    tags=['applications'],
)
class CandidateApplicationRemindView(APIView):
    throttle_classes = with_default_throttles(WriteScopedRateThrottle)
    throttle_scope = 'application_remind'
    permission_classes = [IsCandidate]

    def post(self, request, public_id):
        return _candidate_application_response(
            lambda: request_recruiter_reminder(candidate=request.user, public_id=public_id)
        )


@extend_schema(
    summary='NTD xem snapshot CV bất biến của một đơn ứng tuyển',
    responses={200: RecruiterApplicationSnapshotSerializer},
    tags=['applications'],
)
class RecruiterApplicationSnapshotView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        try:
            application = recruiter_application_snapshot_queryset(request.user).get(
                public_id=public_id
            )
        except Application.DoesNotExist as error:
            # A 404 deliberately avoids confirming the existence of an
            # application outside the posting recruiter's scope.
            raise Http404 from error
        ensure_recruiter_candidate_data_access(request.user)
        application = open_application_snapshot(application, actor=request.user, request=request)
        return Response(
            RecruiterApplicationSnapshotSerializer(
                application,
                context={'request': request},
            ).data
        )


@extend_schema(
    tags=['applications'],
    summary='Luật ứng tuyển, nhắc NTD và tự từ chối',
    responses={200: OpenApiTypes.OBJECT},
)
class ApplicationRulesView(APIView):
    """The limits the clients show, served from the services that enforce them."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(application_rules())
