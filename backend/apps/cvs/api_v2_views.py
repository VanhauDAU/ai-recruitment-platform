"""HTTP endpoints for the candidate-owned CV lifecycle V2 API."""

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from .api_v2_serializers import (
    CvDraftSerializer,
    CvDraftWriteSerializer,
    CvV2CreateSerializer,
    CvV2Serializer,
    CvVersionSerializer,
)
from .models import CvDraft, UserCv
from .selectors import candidate_cv_by_public_id, candidate_cv_versions_queryset, candidate_cvs_queryset
from .services import (
    CvLifecyclePolicyError,
    StaleDraftError,
    create_v2_cv,
    save_draft_as_version,
    update_draft,
)


LOCK_HEADER_RE = re.compile(r'^"?lock-version-(\d+)"?$')


def expected_lock_version(request):
    value = request.headers.get('If-Match', '')
    match = LOCK_HEADER_RE.fullmatch(value.strip())
    if match is None:
        raise ValidationError({'If-Match': 'Use If-Match: "lock-version-<number>".'})
    return int(match.group(1))


def draft_conflict_response(cv):
    current_lock = CvDraft.objects.filter(cv=cv).values_list('lock_version', flat=True).first()
    return Response(
        {
            'detail': 'Draft has changed in another session.',
            'current_lock_version': current_lock,
        },
        status=status.HTTP_409_CONFLICT,
    )


class CandidateV2CvMixin:
    permission_classes = [IsCandidate]

    def get_cv(self):
        try:
            return candidate_cv_by_public_id(self.request.user, self.kwargs['public_id'])
        except self.model.DoesNotExist as error:
            raise Http404 from error


class CvV2ListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCandidate]

    def get_queryset(self):
        return candidate_cvs_queryset(self.request.user).select_related(
            'current_template_version', 'latest_version', 'published_version',
        )

    def get_serializer_class(self):
        return CvV2CreateSerializer if self.request.method == 'POST' else CvV2Serializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cv = create_v2_cv(
                actor=request.user,
                title=serializer.validated_data['title'],
                template=serializer.validated_data['template_public_id'],
                language=serializer.validated_data['language'],
                sample_content=serializer.validated_data.get('sample_content_public_id'),
            )
        except CvLifecyclePolicyError as error:
            raise PermissionDenied(str(error)) from error
        return Response(CvV2Serializer(cv).data, status=status.HTTP_201_CREATED)


class CvV2DetailView(CandidateV2CvMixin, APIView):
    model = UserCv

    def get(self, request, public_id):
        return Response(CvV2Serializer(self.get_cv()).data)


class CvV2DraftView(CandidateV2CvMixin, APIView):
    model = UserCv

    def get(self, request, public_id):
        cv = self.get_cv()
        try:
            draft = CvDraft.objects.select_related('base_version').get(cv=cv)
        except CvDraft.DoesNotExist as error:
            raise Http404 from error
        return Response(CvDraftSerializer(draft).data, headers={'ETag': f'"lock-version-{draft.lock_version}"'})

    def put(self, request, public_id):
        cv = self.get_cv()
        serializer = CvDraftWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            draft = update_draft(
                cv=cv,
                actor=request.user,
                content_json=serializer.validated_data['content_json'],
                layout_json=serializer.validated_data['layout_json'],
                style_json=serializer.validated_data['style_json'],
                expected_lock_version=expected_lock_version(request),
                client_session_id=serializer.validated_data.get('client_session_id', ''),
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except CvLifecyclePolicyError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(CvDraftSerializer(draft).data, headers={'ETag': f'"lock-version-{draft.lock_version}"'})


class CvV2SaveVersionView(CandidateV2CvMixin, APIView):
    model = UserCv
    publish = False

    def post(self, request, public_id):
        cv = self.get_cv()
        try:
            version = save_draft_as_version(
                cv=cv,
                actor=request.user,
                expected_lock_version=expected_lock_version(request),
                publish=self.publish,
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except DjangoValidationError as error:
            detail = error.message_dict if hasattr(error, 'message_dict') else error.messages
            raise ValidationError(detail) from error
        except CvLifecyclePolicyError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(CvVersionSerializer(version).data, status=status.HTTP_201_CREATED)


class CvV2PublishView(CvV2SaveVersionView):
    publish = True


class CvV2VersionListView(CandidateV2CvMixin, generics.ListAPIView):
    model = UserCv
    serializer_class = CvVersionSerializer

    def get_queryset(self):
        self.get_cv()
        return candidate_cv_versions_queryset(self.request.user, self.kwargs['public_id'])


class CvV2VersionDetailView(CandidateV2CvMixin, generics.RetrieveAPIView):
    model = UserCv
    serializer_class = CvVersionSerializer
    lookup_field = 'public_id'
    lookup_url_kwarg = 'version_public_id'

    def get_queryset(self):
        return candidate_cv_versions_queryset(self.request.user, self.kwargs['public_id'])
