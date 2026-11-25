"""API quản trị danh mục lĩnh vực công ty."""

from drf_spectacular.utils import extend_schema

from apps.accounts.api.permissions import AdminPortalPermission
from common.api.catalog import CatalogEntryViewSet

from ...selectors import admin_industries_queryset
from ...services import save_industry
from ..serializers.catalog_admin import AdminIndustrySerializer


@extend_schema(tags=['employers-catalog-admin'])
class AdminIndustryViewSet(CatalogEntryViewSet):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminIndustrySerializer

    def get_queryset(self):
        return admin_industries_queryset()

    def save_entry(self, **kwargs):
        return save_industry(**kwargs)
