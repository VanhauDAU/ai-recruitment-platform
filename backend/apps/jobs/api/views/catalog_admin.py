"""API quản trị danh mục của tin tuyển dụng."""

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission
from common.api.catalog import CatalogEntryViewSet

from ...selectors import (
    admin_benefits_queryset,
    admin_job_categories_queryset,
    admin_languages_queryset,
)
from ...services import (
    reorder_benefits,
    save_catalog_entry,
    save_job_category,
    upload_category_icon,
)
from ..serializers import (
    AdminBenefitSerializer,
    AdminJobCategorySerializer,
    AdminLanguageSerializer,
    BenefitReorderSerializer,
    CategoryIconSerializer,
    CategoryIconUploadSerializer,
    JobCategoryWriteSerializer,
)

TAGS = ['jobs-catalog-admin']


@extend_schema(tags=TAGS)
@extend_schema_view(
    create=extend_schema(
        request=JobCategoryWriteSerializer, responses={201: AdminJobCategorySerializer}
    ),
    partial_update=extend_schema(
        request=JobCategoryWriteSerializer, responses={200: AdminJobCategorySerializer}
    ),
)
class AdminJobCategoryViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Cây ngành nghề ba cấp; cấp của mục suy ra từ mục cha."""

    permission_classes = [AdminPortalPermission]
    serializer_class = AdminJobCategorySerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    lookup_value_regex = r'\d+'

    def get_queryset(self):
        return admin_job_categories_queryset()

    def _respond(self, category, response_status=status.HTTP_200_OK):
        category = self.get_queryset().get(pk=category.pk)
        serializer = AdminJobCategorySerializer(category, context=self.get_serializer_context())
        return Response(serializer.data, status=response_status)

    def create(self, request, *args, **kwargs):
        serializer = JobCategoryWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = save_job_category(actor=request.user, **serializer.validated_data)
        return self._respond(category, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        serializer = JobCategoryWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        category = save_job_category(
            actor=request.user, category=self.get_object(), **serializer.validated_data
        )
        return self._respond(category)


@extend_schema(
    tags=TAGS,
    request={'multipart/form-data': CategoryIconUploadSerializer},
    responses={201: CategoryIconSerializer},
)
class AdminJobCategoryIconUploadView(APIView):
    """Tải icon lên trước; form ngành nghề gửi lại `path` vào `logo_url` khi lưu."""

    permission_classes = [AdminPortalPermission]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = CategoryIconUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        saved = upload_category_icon(upload=serializer.validated_data['file'], request=request)
        return Response(saved, status=status.HTTP_201_CREATED)


@extend_schema(tags=TAGS)
class AdminBenefitViewSet(CatalogEntryViewSet):
    """Phúc lợi chọn khi đăng tin và trên trang công ty; thứ tự đặt bằng `reorder`."""

    permission_classes = [AdminPortalPermission]
    serializer_class = AdminBenefitSerializer

    def get_queryset(self):
        return admin_benefits_queryset()

    def save_entry(self, **kwargs):
        return save_catalog_entry(**kwargs)

    @extend_schema(
        request=BenefitReorderSerializer, responses={200: AdminBenefitSerializer(many=True)}
    )
    @action(detail=False, methods=['post'])
    def reorder(self, request):
        serializer = BenefitReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reorder_benefits(actor=request.user, ids=serializer.validated_data['ids'])
        return Response(AdminBenefitSerializer(self.get_queryset(), many=True).data)


@extend_schema(tags=TAGS)
class AdminLanguageViewSet(CatalogEntryViewSet):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminLanguageSerializer

    def get_queryset(self):
        return admin_languages_queryset()

    def save_entry(self, **kwargs):
        return save_catalog_entry(**kwargs)
