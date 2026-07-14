from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from .serializers import (
    CandidateJobPreferenceSerializer,
    CandidateProfileReadSerializer,
    CandidateProfileUpdateSerializer,
)
from .selectors import candidate_job_preference_for_user, candidate_profile_for_user
from .services import replace_candidate_job_preferences, update_candidate_profile


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
        preference = replace_candidate_job_preferences(current.candidate_profile, serializer.validated_data)
        preference = candidate_job_preference_for_user(request.user)
        return Response(CandidateJobPreferenceSerializer(preference).data)
