from rest_framework import generics
from rest_framework.exceptions import NotFound

from apps.accounts.permissions import IsEmployer

from .models import EmployerProfile
from .serializers import EmployerProfileSerializer


class MyEmployerProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = EmployerProfileSerializer
    permission_classes = [IsEmployer]

    def get_object(self):
        try:
            return EmployerProfile.objects.get(user=self.request.user)
        except EmployerProfile.DoesNotExist:
            raise NotFound('Employer profile not created yet. Use POST to create it.')


class CreateEmployerProfileView(generics.CreateAPIView):
    serializer_class = EmployerProfileSerializer
    permission_classes = [IsEmployer]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
