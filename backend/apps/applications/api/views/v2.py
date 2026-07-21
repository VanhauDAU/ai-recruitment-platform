"""V2 candidate submission and recruiter immutable-snapshot reads."""

from django.db import IntegrityError
from django.http import Http404
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate, IsEmployerWithMFA

from ...models import Application
from ...selectors import candidate_applications_queryset, recruiter_application_snapshot_queryset
from ...services import create_application_record
from ..serializers.v2 import (
    CandidateApplicationV2CreateSerializer,
    CandidateApplicationV2Serializer,
    RecruiterApplicationSnapshotSerializer,
)


class CandidateApplicationV2ListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCandidate]

    def get_queryset(self):
        return candidate_applications_queryset(self.request.user)

    def get_serializer_class(self):
        return (
            CandidateApplicationV2CreateSerializer
            if self.request.method == 'POST'
            else CandidateApplicationV2Serializer
        )

    def create(self, request, *args, **kwargs):
        if not request.user.email_verified:
            raise ValidationError({'detail': 'Verify your email before applying for a job.'})
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
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
            )
        except ValueError as error:
            raise ValidationError({'version_public_id': str(error)}) from error
        except IntegrityError:
            return Response(
                {'detail': 'You already applied to this job.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            CandidateApplicationV2Serializer(application).data, status=status.HTTP_201_CREATED
        )


class RecruiterApplicationSnapshotView(APIView):
    permission_classes = [IsEmployerWithMFA]

    def get(self, request, public_id):
        try:
            application = recruiter_application_snapshot_queryset(request.user).get(
                public_id=public_id
            )
        except Application.DoesNotExist as error:
            # A 404 deliberately avoids confirming the existence of an
            # application outside the recruiter’s company relationship.
            raise Http404 from error
        return Response(RecruiterApplicationSnapshotSerializer(application).data)
