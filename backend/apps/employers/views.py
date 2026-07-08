from rest_framework import generics, permissions
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

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


class IndustryListView(APIView):
    """Danh sách lĩnh vực công ty (distinct) cho bộ lọc "Lĩnh vực công ty"."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        industries = (
            EmployerProfile.objects.exclude(industry='')
            .order_by('industry')
            .values_list('industry', flat=True)
            .distinct()
        )
        return Response(list(industries))
