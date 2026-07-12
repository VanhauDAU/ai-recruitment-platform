from rest_framework import generics

from apps.accounts.permissions import IsCandidate

from .serializers import CandidateProfileSerializer
from .selectors import candidate_profile_for_user
from .services import update_candidate_profile


class MyCandidateProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [IsCandidate]

    def get_object(self):
        return candidate_profile_for_user(self.request.user)

    def perform_update(self, serializer):
        update_candidate_profile(serializer)
