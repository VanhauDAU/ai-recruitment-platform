from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view, inline_serializer
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from ...models import CandidateConsent
from ...selectors import candidate_job_preference_for_user, candidate_profile_for_user
from ...services import (
    replace_candidate_job_preferences,
    set_recruiter_visibility,
    update_candidate_profile,
)
from ..serializers import (
    CandidateJobPreferenceSerializer,
    CandidateProfileReadSerializer,
    CandidateProfileUpdateSerializer,
    RecruiterVisibilitySerializer,
)


class MyCandidateProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsCandidate]
    http_method_names = ['get', 'patch']

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return CandidateProfileUpdateSerializer
        return CandidateProfileReadSerializer

    def get_object(self):
        return candidate_profile_for_user(self.request.user)

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_candidate_profile(serializer)
        return Response(CandidateProfileReadSerializer(serializer.instance).data)


@extend_schema_view(
    get=extend_schema(
        summary='Đọc tiêu chí tìm việc của tôi',
        responses={200: CandidateJobPreferenceSerializer},
    ),
    put=extend_schema(
        summary='Cập nhật tiêu chí tìm việc',
        request=CandidateJobPreferenceSerializer,
        responses={200: CandidateJobPreferenceSerializer},
    ),
)
@extend_schema(tags=['candidate'])
class MyCandidateJobPreferencesView(APIView):
    """Read and replace the current candidate job-search preference set."""

    permission_classes = [IsCandidate]

    def get(self, request):
        preference = candidate_job_preference_for_user(request.user)
        return Response(CandidateJobPreferenceSerializer(preference).data)

    def put(self, request):
        current = candidate_job_preference_for_user(request.user)
        serializer = CandidateJobPreferenceSerializer(current, data=request.data)
        serializer.is_valid(raise_exception=True)
        preference = replace_candidate_job_preferences(
            current.candidate_profile, serializer.validated_data
        )
        preference = candidate_job_preference_for_user(request.user)
        return Response(CandidateJobPreferenceSerializer(preference).data)


@extend_schema_view(
    get=extend_schema(
        summary='Trạng thái đồng ý cho NTD tìm thấy hồ sơ',
        responses={
            200: inline_serializer(
                'RecruiterVisibilityStatus',
                {
                    'enabled': serializers.BooleanField(),
                    'policy_version': serializers.CharField(),
                    'decided_at': serializers.DateTimeField(allow_null=True),
                },
            )
        },
    ),
    patch=extend_schema(
        summary='Bật/tắt đồng ý cho NTD tìm thấy hồ sơ',
        request=RecruiterVisibilitySerializer,
        responses={200: OpenApiTypes.OBJECT},
    ),
)
@extend_schema(tags=['candidate'])
class MyRecruiterVisibilityView(APIView):
    """Purpose-specific recruiter-search consent; independent from job preferences."""

    permission_classes = [IsCandidate]

    def get(self, request):
        profile = candidate_profile_for_user(request.user)
        consent = profile.consents.filter(
            consent_type=CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
        ).first()
        return Response(
            {
                'enabled': bool(consent and consent.decision == CandidateConsent.Decision.GRANTED),
                'policy_version': consent.policy_version if consent else 'v1',
                'decided_at': consent.decided_at if consent else None,
            }
        )

    def patch(self, request):
        serializer = RecruiterVisibilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cv_public_id = data.get('cv_public_id', '')
        if (
            cv_public_id
            and not request.user.cvs.filter(public_id=cv_public_id, is_deleted=False).exists()
        ):
            from rest_framework.exceptions import ValidationError

            raise ValidationError({'cv_public_id': 'CV không thuộc tài khoản hiện tại.'})
        consent = set_recruiter_visibility(
            candidate_profile_for_user(request.user),
            enabled=data['enabled'],
            policy_version=data['policy_version'],
            source=data['source'],
            source_path=data.get('source_path', ''),
            cv_public_id=cv_public_id,
        )
        return Response(
            {
                'enabled': consent.decision == CandidateConsent.Decision.GRANTED,
                'policy_version': consent.policy_version,
                'decided_at': consent.decided_at,
            }
        )
