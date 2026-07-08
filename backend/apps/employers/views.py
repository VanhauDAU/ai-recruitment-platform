from rest_framework import generics, permissions
from rest_framework.exceptions import NotFound

from apps.accounts.permissions import IsEmployer

from .models import EmployerProfile, Industry
from .serializers import EmployerProfileSerializer, IndustrySerializer


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


class IndustryListView(generics.ListAPIView):
    """Danh sách lĩnh vực công ty cho bộ lọc "Lĩnh vực công ty" (chỉ những lĩnh vực đang có công ty)."""

    serializer_class = IndustrySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = Industry.objects.filter(employers__isnull=False).distinct()
