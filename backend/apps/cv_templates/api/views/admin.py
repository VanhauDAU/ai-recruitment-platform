from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission
from apps.jobs.models import JobCategory

from ...models import CvTemplate
from ...selectors import (
    admin_backgrounds_queryset,
    admin_categories_queryset,
    admin_colors_queryset,
    admin_position_fields_queryset,
    admin_position_profiles_queryset,
    admin_sample_contents_queryset,
    admin_sample_generations_queryset,
    admin_template_version,
    admin_templates_queryset,
    cv_admin_overview,
    template_version,
)
from ...services import (
    PositionContentUnavailable,
    archive_sample,
    configure_version,
    coverage_matrix,
    create_background_asset,
    create_draft_version,
    create_template,
    delete_library_item,
    duplicate_template,
    enqueue_template_snapshots,
    estimate_generation_cost,
    export_positions,
    import_positions,
    preview_document,
    publish_checked_template_version,
    publish_checklist,
    publish_sample,
    reorder_templates,
    request_sample_generations,
    request_test_pdf,
    retire_template_version,
    set_template_colors,
    set_template_visibility,
    test_pdf_job,
    test_pdf_passed,
    update_template,
)
from ..serializers.admin import (
    CvBackgroundAdminSerializer,
    CvCategoryAdminSerializer,
    CvColorAdminSerializer,
    CvPositionFieldAdminSerializer,
    CvPositionProfileAdminSerializer,
    CvSampleContentAdminSerializer,
    CvSampleGenerationRequestSerializer,
    CvSampleGenerationSerializer,
    CvTemplateAdminSerializer,
    CvTemplateVersionAdminSerializer,
    TemplateColorsSerializer,
    TemplateLayoutSerializer,
    TemplatePreviewSerializer,
    TemplateVersionConfigSerializer,
)

ADMIN_TAGS = ['cv-templates-admin']
POSITION_FILTER = OpenApiParameter('position', str, description='Mã JobCategory của vị trí')


class AdminModelViewSet(viewsets.ModelViewSet):
    permission_classes = [AdminPortalPermission]
    pagination_class = None


@extend_schema(tags=ADMIN_TAGS)
class AdminCvTemplateViewSet(AdminModelViewSet):
    serializer_class = CvTemplateAdminSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_templates_queryset()

    def _template_response(self, template, **kwargs):
        return Response(self.get_serializer(self.get_queryset().get(pk=template.pk)).data, **kwargs)

    def create(self, request, *args, **kwargs):
        """Tạo mẫu; gửi kèm `renderer_key` thì mẫu có ngay bản nháp đủ section và màu."""
        layout = TemplateLayoutSerializer(data=request.data)
        layout.is_valid(raise_exception=True)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = create_template(
            renderer_key=layout.validated_data.get('renderer_key'),
            actor=request.user,
            **serializer.validated_data,
        )
        return self._template_response(template, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        serializer.instance = update_template(serializer.instance, **serializer.validated_data)

    @extend_schema(
        request=TemplateLayoutSerializer, responses={201: CvTemplateVersionAdminSerializer}
    )
    @action(detail=True, methods=['post'], url_path='versions')
    def create_version(self, request, public_id=None):
        layout = TemplateLayoutSerializer(data=request.data)
        layout.is_valid(raise_exception=True)
        version = create_draft_version(
            template=self.get_object(),
            renderer_key=layout.validated_data.get('renderer_key'),
            actor=request.user,
        )
        return Response(
            CvTemplateVersionAdminSerializer(admin_template_version(version.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def _version(self, template, version_pk):
        version = template_version(template, version_pk)
        if version is None:
            raise ValidationError({'version': 'Unknown template version.'})
        return version

    @extend_schema(request=None, responses={200: CvTemplateVersionAdminSerializer})
    @action(detail=True, methods=['post'], url_path=r'versions/(?P<version_pk>\d+)/publish')
    def publish_version(self, request, public_id=None, version_pk=None):
        template = self.get_object()
        version = publish_checked_template_version(
            template=template,
            version=self._version(template, version_pk),
            actor=request.user,
        )
        return Response(CvTemplateVersionAdminSerializer(version).data)

    @extend_schema(
        request=TemplateVersionConfigSerializer, responses={200: CvTemplateVersionAdminSerializer}
    )
    @action(detail=True, methods=['patch'], url_path=r'versions/(?P<version_pk>\d+)/config')
    def configure_version(self, request, public_id=None, version_pk=None):
        """Lưu một bước của wizard vào phiên bản nháp."""
        template = self.get_object()
        serializer = TemplateVersionConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = configure_version(
            version=self._version(template, version_pk),
            **serializer.validated_data,
        )
        return Response(CvTemplateVersionAdminSerializer(admin_template_version(version.pk)).data)

    @extend_schema(request=TemplateColorsSerializer, responses={200: CvTemplateAdminSerializer})
    @action(detail=True, methods=['put'], url_path='colors')
    def set_colors(self, request, public_id=None):
        serializer = TemplateColorsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = set_template_colors(
            template=self.get_object(),
            color_public_ids=serializer.validated_data['color_public_ids'],
            default_public_id=serializer.validated_data['default_color_public_id'],
        )
        return self._template_response(template)

    def _preview_options(self, request):
        serializer = TemplatePreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        data.pop('version_id', None)
        return serializer.validated_data.get('version_id'), data

    @extend_schema(request=TemplatePreviewSerializer, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=['post'])
    def preview(self, request, public_id=None):
        """Document xem trước của một phiên bản (mặc định bản đang xuất bản)."""
        template = self.get_object()
        version_id, options = self._preview_options(request)
        version = (
            self._version(template, version_id)
            if version_id
            else template.current_published_version
        )
        if version is None:
            raise ValidationError({'version_id': 'Chọn một phiên bản để xem trước.'})
        try:
            document = preview_document(template, version, **options)
        except (PositionContentUnavailable, JobCategory.DoesNotExist) as error:
            raise ValidationError({'position_public_id': 'Vị trí chưa có nội dung mẫu.'}) from error
        except DjangoValidationError as error:
            raise ValidationError({'document': error.messages}) from error
        return Response({'document': document, 'renderer_key': version.renderer_key})

    @extend_schema(request=TemplatePreviewSerializer, responses={202: OpenApiTypes.OBJECT})
    @action(detail=True, methods=['post'], url_path=r'versions/(?P<version_pk>\d+)/test-pdf')
    def test_pdf(self, request, public_id=None, version_pk=None):
        version = self._version(self.get_object(), version_pk)
        _, options = self._preview_options(request)
        token = request_test_pdf(version, options)
        return Response({'token': token, 'status': 'pending'}, status=status.HTTP_202_ACCEPTED)

    @extend_schema(
        parameters=[OpenApiParameter('download', bool)],
        responses={
            (200, 'application/json'): OpenApiTypes.OBJECT,
            (200, 'application/pdf'): OpenApiTypes.BINARY,
        },
    )
    @action(detail=False, methods=['get'], url_path=r'test-pdf/(?P<token>[0-9a-f]{32})')
    def test_pdf_result(self, request, token=None):
        job = test_pdf_job(token)
        if job is None:
            raise ValidationError({'token': 'Kết quả đã hết hạn.'})
        if job['status'] == 'ready' and request.query_params.get('download'):
            response = HttpResponse(job['pdf'], content_type='application/pdf')
            response['Content-Disposition'] = 'inline; filename="cv-template-test.pdf"'
            response['Cache-Control'] = 'private, no-store'
            return response
        return Response({'status': job['status']})

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=['get'], url_path=r'versions/(?P<version_pk>\d+)/checklist')
    def checklist(self, request, public_id=None, version_pk=None):
        template = self.get_object()
        version = self._version(template, version_pk)
        return Response(
            {'items': publish_checklist(template, version, test_pdf_ok=test_pdf_passed(version))}
        )

    @extend_schema(request=None, responses={201: CvTemplateAdminSerializer})
    @action(detail=True, methods=['post'])
    def duplicate(self, request, public_id=None):
        template = duplicate_template(template=self.get_object(), actor=request.user)
        return self._template_response(template, status=status.HTTP_201_CREATED)

    @extend_schema(request=OpenApiTypes.OBJECT, responses={204: None})
    @action(detail=False, methods=['post'])
    def reorder(self, request):
        public_ids = request.data.get('public_ids')
        if not isinstance(public_ids, list) or not public_ids:
            raise ValidationError({'public_ids': 'Gửi danh sách mã template theo thứ tự.'})
        reorder_templates(public_ids=public_ids)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: CvTemplateAdminSerializer})
    @action(detail=True, methods=['post'])
    def lifecycle(self, request, public_id=None):
        """Ẩn (lưu trữ) hoặc hiện lại template đã có phiên bản xuất bản."""
        template = set_template_visibility(
            template=self.get_object(),
            visible=request.data.get('status') == CvTemplate.LifecycleStatus.PUBLISHED,
        )
        return self._template_response(template)

    @extend_schema(request=None, responses={200: CvTemplateVersionAdminSerializer})
    @action(detail=True, methods=['post'], url_path=r'versions/(?P<version_pk>\d+)/retire')
    def retire_version(self, request, public_id=None, version_pk=None):
        template = self.get_object()
        version = retire_template_version(
            template=template, version=self._version(template, version_pk)
        )
        return Response(CvTemplateVersionAdminSerializer(version).data)

    @extend_schema(request=None, responses={202: OpenApiTypes.OBJECT})
    @action(detail=True, methods=['post'], url_path='snapshots/regenerate')
    def regenerate_snapshots(self, request, public_id=None):
        enqueue_template_snapshots(self.get_object())
        return Response({'status': 'queued'}, status=status.HTTP_202_ACCEPTED)


class LibraryItemViewSet(AdminModelViewSet):
    """Danh mục/màu đang được mẫu CV dùng thì không xóa được (CVT-4)."""

    lookup_field = 'public_id'

    def perform_destroy(self, instance):
        delete_library_item(instance)


@extend_schema(tags=ADMIN_TAGS)
class AdminCvCategoryViewSet(LibraryItemViewSet):
    serializer_class = CvCategoryAdminSerializer

    def get_queryset(self):
        return admin_categories_queryset()


@extend_schema(tags=ADMIN_TAGS)
class AdminCvColorViewSet(LibraryItemViewSet):
    serializer_class = CvColorAdminSerializer

    def get_queryset(self):
        return admin_colors_queryset()


@extend_schema(tags=ADMIN_TAGS)
class AdminCvBackgroundViewSet(AdminModelViewSet):
    serializer_class = CvBackgroundAdminSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_backgrounds_queryset()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data.get('file')
        if upload is None:
            raise ValidationError({'file': 'This field is required.'})
        asset = create_background_asset(
            upload=upload,
            title=serializer.validated_data.get('title', ''),
        )
        return Response(
            self.get_serializer(asset).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        asset = self.get_object()
        allowed = {key: request.data[key] for key in ('title', 'is_active') if key in request.data}
        serializer = self.get_serializer(asset, data=allowed, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        # Xóa ảnh nền chỉ ẩn nó khỏi thư viện; tệp và bản ghi được giữ.
        self.get_object().deactivate()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=ADMIN_TAGS)
@extend_schema_view(
    list=extend_schema(
        parameters=[
            POSITION_FILTER,
            OpenApiParameter('locale', str),
            OpenApiParameter('band', str),
            OpenApiParameter('status', str),
        ]
    )
)
class AdminCvSampleContentViewSet(AdminModelViewSet):
    serializer_class = CvSampleContentAdminSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_sample_contents_queryset(self.request.query_params)

    @extend_schema(
        request=CvSampleGenerationRequestSerializer, responses={202: OpenApiTypes.OBJECT}
    )
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Xếp hàng sinh nội dung mẫu bằng AI; kết quả vào trạng thái chờ duyệt."""
        serializer = CvSampleGenerationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        generations = request_sample_generations(
            actor=request.user,
            profiles=data['position_public_ids'],
            locales=sorted(data['locales']),
            bands=sorted(data['experience_bands']),
        )
        return Response(
            {
                'batch_id': generations[0].batch_id,
                'generations': CvSampleGenerationSerializer(generations, many=True).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @extend_schema(request=None, responses={200: CvSampleContentAdminSerializer})
    @action(detail=True, methods=['post'])
    def publish(self, request, public_id=None):
        sample = publish_sample(sample=self.get_object(), actor=request.user)
        return Response(self.get_serializer(sample).data)

    @extend_schema(request=None, responses={200: CvSampleContentAdminSerializer})
    @action(detail=True, methods=['post'])
    def archive(self, request, public_id=None):
        sample = archive_sample(sample=self.get_object())
        return Response(self.get_serializer(sample).data)


@extend_schema(tags=ADMIN_TAGS)
@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter('batch', str)]))
class AdminCvSampleGenerationViewSet(AdminModelViewSet):
    """Trạng thái các lượt sinh AI, lọc theo `?batch=`; chỉ đọc."""

    serializer_class = CvSampleGenerationSerializer
    lookup_field = 'public_id'
    http_method_names = ['get', 'head', 'options']

    @extend_schema(
        parameters=[OpenApiParameter('count', int)], responses={200: OpenApiTypes.OBJECT}
    )
    @action(detail=False, methods=['get'])
    def estimate(self, request):
        """Chi phí ước tính cho `count` lượt, theo trung bình các lượt thành công gần đây."""
        try:
            count = int(request.query_params.get('count', 1))
        except ValueError as error:
            raise ValidationError({'count': 'Phải là số.'}) from error
        return Response(estimate_generation_cost(count))

    def get_queryset(self):
        return admin_sample_generations_queryset(batch=self.request.query_params.get('batch'))


@extend_schema(tags=ADMIN_TAGS)
@extend_schema_view(list=extend_schema(parameters=[POSITION_FILTER]))
class AdminCvPositionViewSet(AdminModelViewSet):
    """Cấu hình CV theo vị trí: bộ section, từ khóa; độ phủ nội dung; import/export JSON."""

    serializer_class = CvPositionProfileAdminSerializer
    lookup_field = 'public_id'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        return admin_position_profiles_queryset(positions=self.request.query_params.get('position'))

    @extend_schema(parameters=[POSITION_FILTER], responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=['get'])
    def coverage(self, request):
        profiles = list(self.get_queryset())
        matrix = coverage_matrix(profiles)
        return Response(
            {
                'results': [
                    {
                        'position_public_id': profile.job_category.public_id,
                        'position_name': profile.job_category.name,
                        'coverage': matrix[profile.pk],
                    }
                    for profile in profiles
                ]
            }
        )

    @extend_schema(parameters=[POSITION_FILTER], responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=['get'])
    def export(self, request):
        return Response(export_positions(self.get_queryset()))

    @extend_schema(request=OpenApiTypes.OBJECT, responses={201: OpenApiTypes.OBJECT})
    @action(detail=False, methods=['post'], url_path='import')
    def import_positions(self, request):
        result = import_positions(payload=request.data, actor=request.user)
        return Response(result, status=status.HTTP_201_CREATED)


@extend_schema(tags=ADMIN_TAGS)
@extend_schema_view(list=extend_schema(parameters=[POSITION_FILTER]))
class AdminCvPositionFieldViewSet(AdminModelViewSet):
    """Trường riêng của vị trí, lọc theo `?position=` (mã `JobCategory`)."""

    serializer_class = CvPositionFieldAdminSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_position_fields_queryset(position=self.request.query_params.get('position'))


@extend_schema(
    summary='Số liệu và việc cần làm của trang Tổng quan Mẫu CV',
    responses={200: OpenApiTypes.OBJECT},
    tags=ADMIN_TAGS,
)
class AdminCvOverviewView(APIView):
    """Số liệu và việc cần làm của trang Tổng quan Mẫu CV."""

    permission_classes = [AdminPortalPermission]

    def get(self, request):
        return Response(cv_admin_overview())
