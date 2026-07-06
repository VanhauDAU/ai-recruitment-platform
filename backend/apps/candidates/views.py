from rest_framework import generics

from apps.accounts.permissions import IsCandidate

from .models import CandidateProfile
from .serializers import CandidateProfileSerializer


class MyCandidateProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [IsCandidate]

    def get_object(self):
        profile, _ = CandidateProfile.objects.get_or_create(user=self.request.user)
        return profile
