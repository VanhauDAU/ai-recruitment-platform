"""Admin template workspace: template CRUD, versions, wizard config, preview and publishing."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.jobs.models import JobCategory
from common.api.params import parse_bool

from ...models import CvTemplate
from ...selectors import admin_template_version, admin_templates_queryset, template_version
from ...services import (
    PositionContentUnavailable,
    configure_version,
    create_draft_version,
    create_template,
    duplicate_template,
    enqueue_template_snapshots,
    preview_document,
    publish_checked_template_version,
    publish_checklist,
    reorder_templates,
    request_test_pdf,
    retire_template_version,
    set_template_colors,
    set_template_visibility,
    test_pdf_job,
    test_pdf_passed,
    update_template,
)
from ..serializers.admin_templates import (
    CvTemplateAdminSerializer,
    CvTemplateVersionAdminSerializer,
    TemplateColorsSerializer,
    TemplateLayoutSerializer,
    TemplatePreviewSerializer,
    TemplateVersionConfigSerializer,
)
from .admin_base import ADMIN_TAGS, AdminModelViewSet


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
        if job['status'] == 'ready' and parse_bool(request.query_params.get('download'), False):
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
