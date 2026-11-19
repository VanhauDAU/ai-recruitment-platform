"""Building blocks shared by the CV endpoints: ownership lookup, optimistic locking
and the read-only (immutable version) payload used by owner and share views."""

import re

from django.http import FileResponse, Http404
from drf_spectacular.utils import inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.api.permissions import IsCandidate
from apps.cvs.api.serializers import SharedCvVersionSerializer
from apps.cvs.models import UserCv
from apps.cvs.selectors import candidate_cv_by_public_id, current_draft_lock_version
from apps.cvs.services import open_uploaded_cv_pdf
from common.metrics import record_metric

LOCK_HEADER_RE = re.compile(r'^"?lock-version-(\d+)"?$')


class CandidateCvMixin:
    permission_classes = [IsCandidate]

    def get_cv(self):
        # Another candidate's CV is a 404, never a 403: existence is not disclosed.
        try:
            return candidate_cv_by_public_id(self.request.user, self.kwargs['public_id'])
        except UserCv.DoesNotExist as error:
            raise Http404 from error


def expected_lock_version(request):
    value = request.headers.get('If-Match', '')
    match = LOCK_HEADER_RE.fullmatch(value.strip())
    if match is None:
        raise ValidationError({'If-Match': 'Use If-Match: "lock-version-<number>".'})
    return int(match.group(1))


def draft_headers(draft):
    """ETag the client echoes back in ``If-Match`` on its next draft write."""
    return {'ETag': f'"lock-version-{draft.lock_version}"'}


def draft_conflict_response(cv):
    record_metric('cv_autosave_conflict')
    return Response(
        {
            'detail': 'Draft has changed in another session.',
            'current_lock_version': current_draft_lock_version(cv),
        },
        status=status.HTTP_409_CONFLICT,
    )


def validation_detail(error):
    """Field errors of a Django ``ValidationError``; message of a policy error as ``detail``."""
    return error.message_dict if hasattr(error, 'message_dict') else {'detail': str(error)}


def read_only_cv_schema(name, summary_name):
    return inline_serializer(
        name,
        {
            'cv': inline_serializer(
                summary_name,
                {
                    'public_id': serializers.CharField(),
                    'title': serializers.CharField(),
                    'language': serializers.CharField(),
                    'is_default': serializers.BooleanField(),
                    'cv_type': serializers.CharField(),
                },
            ),
            'version': SharedCvVersionSerializer(),
        },
    )


def read_only_cv_payload(cv, version, request=None):
    return {
        'cv': {
            'public_id': cv.public_id,
            'title': cv.title,
            'language': cv.language,
            'is_default': cv.is_default,
            'cv_type': cv.cv_type,
        },
        'version': SharedCvVersionSerializer(version, context={'request': request}).data,
    }


def uploaded_cv_pdf_response(cv):
    stream = open_uploaded_cv_pdf(cv)
    if stream is None:
        raise Http404
    response = FileResponse(
        stream, content_type='application/pdf', filename=f'{cv.public_id}.pdf', as_attachment=False
    )
    response['Cache-Control'] = 'private, no-store'
    return response
