"""Shared base of the cv_templates admin viewsets."""

from drf_spectacular.utils import OpenApiParameter
from rest_framework import viewsets

from apps.accounts.api.permissions import AdminPortalPermission

ADMIN_TAGS = ['cv-templates-admin']
POSITION_FILTER = OpenApiParameter('position', str, description='Mã JobCategory của vị trí')


# Admin lists are bounded catalogues edited on one screen, so they are not paginated.
class AdminModelViewSet(viewsets.ModelViewSet):
    permission_classes = [AdminPortalPermission]
    pagination_class = None
