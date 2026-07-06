from rest_framework import generics, permissions

from .models import CvTemplate
from .serializers import CvTemplateSerializer


class CvTemplateListView(generics.ListAPIView):
    serializer_class = CvTemplateSerializer
    permission_classes = [permissions.AllowAny]
    queryset = CvTemplate.objects.filter(status=CvTemplate.Status.ACTIVE)


class CvTemplateDetailView(generics.RetrieveAPIView):
    serializer_class = CvTemplateSerializer
    permission_classes = [permissions.AllowAny]
    queryset = CvTemplate.objects.filter(status=CvTemplate.Status.ACTIVE)
    lookup_field = 'slug'
