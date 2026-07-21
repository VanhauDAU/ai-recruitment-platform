from rest_framework import generics, permissions

from common.api_deprecation import LegacyApiDeprecationMixin

from .selectors import active_cv_templates_queryset
from .serializers import CvTemplateSerializer


class CvTemplateListView(LegacyApiDeprecationMixin, generics.ListAPIView):
    serializer_class = CvTemplateSerializer
    permission_classes = [permissions.AllowAny]
    queryset = active_cv_templates_queryset()
    deprecation_contract = 'cv-templates-v1'
    deprecation_successor = '/api/v2/cv-templates/'


class CvTemplateDetailView(LegacyApiDeprecationMixin, generics.RetrieveAPIView):
    serializer_class = CvTemplateSerializer
    permission_classes = [permissions.AllowAny]
    queryset = active_cv_templates_queryset()
    lookup_field = 'slug'
    deprecation_contract = 'cv-templates-v1'
    deprecation_successor = '/api/v2/cv-templates/'
