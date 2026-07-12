from rest_framework import generics, permissions

from .serializers import CvTemplateSerializer
from .selectors import active_cv_templates_queryset


class CvTemplateListView(generics.ListAPIView):
    serializer_class = CvTemplateSerializer
    permission_classes = [permissions.AllowAny]
    queryset = active_cv_templates_queryset()


class CvTemplateDetailView(generics.RetrieveAPIView):
    serializer_class = CvTemplateSerializer
    permission_classes = [permissions.AllowAny]
    queryset = active_cv_templates_queryset()
    lookup_field = 'slug'
