"""Immutable CV versions: save/publish the draft and read the version history."""

from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cvs.api.serializers import CvVersionSerializer, CvVersionSummarySerializer
from apps.cvs.selectors import candidate_cv_versions_queryset
from apps.cvs.services import CvLifecyclePolicyError, StaleDraftError, save_draft_as_version
from common.api.throttling import WriteScopedRateThrottle, with_default_throttles

from .base import CandidateCvMixin, draft_conflict_response, expected_lock_version


class CvSaveVersionView(CandidateCvMixin, APIView):
    publish = False

    @extend_schema(
        summary='Lưu bản nháp thành version bất biến',
        request=None,
        responses={201: CvVersionSerializer, 409: OpenApiTypes.OBJECT},
        tags=['cvs'],
    )
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
        except CvLifecyclePolicyError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(CvVersionSerializer(version).data, status=status.HTTP_201_CREATED)


class CvPublishView(CvSaveVersionView):
    throttle_classes = with_default_throttles(WriteScopedRateThrottle)
    throttle_scope = 'cv_publish'
    publish = True


@extend_schema(summary='Lịch sử version bất biến của CV', tags=['cvs'])
class CvVersionListView(CandidateCvMixin, generics.ListAPIView):
    serializer_class = CvVersionSummarySerializer

    def get_queryset(self):
        # Resolve the CV first so a foreign or missing CV is a 404, not an empty page.
        self.get_cv()
        return candidate_cv_versions_queryset(self.request.user, self.kwargs['public_id'])


@extend_schema(summary='Chi tiết một version của CV', tags=['cvs'])
class CvVersionDetailView(CandidateCvMixin, generics.RetrieveAPIView):
    serializer_class = CvVersionSerializer
    lookup_field = 'public_id'
    lookup_url_kwarg = 'version_public_id'

    def get_queryset(self):
        return candidate_cv_versions_queryset(self.request.user, self.kwargs['public_id'])
