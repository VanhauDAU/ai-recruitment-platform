"""Per-CV opt-in for recruiter search, gated by the profile-level consent."""

from http import HTTPStatus

from rest_framework.exceptions import APIException

from apps.candidates.models import CandidateConsent


class RecruiterConsentRequired(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'RECRUITER_CONSENT_REQUIRED'
    default_detail = {
        'code': default_code,
        'message': 'Hãy đồng ý cho nhà tuyển dụng tìm kiếm hồ sơ trước khi bật cho CV này.',
    }


def recruiter_visibility_granted(user):
    return CandidateConsent.objects.filter(
        candidate_profile__user=user,
        consent_type=CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
        decision=CandidateConsent.Decision.GRANTED,
    ).exists()
