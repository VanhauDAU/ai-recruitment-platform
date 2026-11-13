from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, Max
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import HasAdminPermission
from apps.accounts.selectors import effective_permission_codes
from apps.cvs.models import CvAsset
from apps.cvs.services import create_background_asset
from apps.cvs.services.composition import compose_cv_document

from ...models import (
    CvCategory,
    CvColor,
    CvPositionField,
    CvPositionProfile,
    CvSampleContent,
    CvSampleGeneration,
    CvTemplate,
    CvTemplateSection,
    CvTemplateVersion,
)
from ...services import (
    SampleGenerationUnavailable,
    archive_sample,
    coverage_matrix,
    export_positions,
    import_positions,
    publish_sample,
    publish_template_version,
    request_sample_generations,
    retire_template_version,
)
from ...tasks import enqueue_template_snapshots, regenerate_all_template_snapshots
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
)


def _call(service, **kwargs):
    try:
        return service(**kwargs)
    except DjangoValidationError as error:
        raise ValidationError(
            error.message_dict if hasattr(error, 'message_dict') else error.messages
        ) from error


class AdminModelViewSet(viewsets.ModelViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = None
    required_admin_permissions = {
        'list': ['cv_template.view'],
        'retrieve': ['cv_template.view'],
        'create': ['cv_template.create'],
        'update': ['cv_template.edit'],
        'partial_update': ['cv_template.edit'],
        'destroy': ['cv_template.delete'],
    }

    def _safe_create_overrides(self, serializer):
        if 'cv_template.publish' in effective_permission_codes(self.request.user):
            return {}
        model = serializer.Meta.model
        if hasattr(model, 'is_active'):
            return {'is_active': False}
        return {}

    def perform_create(self, serializer):
        serializer.save(**self._safe_create_overrides(serializer))


class AdminCvTemplateViewSet(AdminModelViewSet):
    serializer_class = CvTemplateAdminSerializer
    lookup_field = 'public_id'
    queryset = CvTemplate.objects.prefetch_related('versions').order_by('sort_order', 'name')
    required_admin_permissions = {
        **AdminModelViewSet.required_admin_permissions,
        'create_version': ['cv_template.create'],
        'publish_version': ['cv_template.publish'],
        'retire_version': ['cv_template.archive'],
        'regenerate_snapshots': ['cv_template.edit'],
    }

    @action(detail=True, methods=['post'], url_path='versions')
    def create_version(self, request, public_id=None):
        template = self.get_object()
        source = template.current_published_version
        if source is None and not request.data:
            raise ValidationError(
                {'version': 'Provide renderer/layout/style for the first draft version.'}
            )
        defaults = (
            {
                key: getattr(source, key)
                for key in (
                    'renderer_key',
                    'renderer_version',
                    'schema_version',
                    'layout_schema',
                    'style_schema',
                    'default_layout_json',
                    'default_style_json',
                    'capabilities',
                    'content_contract',
                )
            }
            if source
            else {}
        )
        serializer = CvTemplateVersionAdminSerializer(data={**defaults, **request.data})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            version_number = (
                template.versions.aggregate(value=Max('version_number'))['value'] or 0
            ) + 1
            version = serializer.save(
                template=template,
                version_number=version_number,
                version_status=CvTemplateVersion.VersionStatus.DRAFT,
                created_by=request.user,
            )
            if source:
                CvTemplateSection.objects.bulk_create(
                    [
                        CvTemplateSection(
                            template_version=version,
                            section_definition=item.section_definition,
                            region_key=item.region_key,
                            default_order=item.default_order,
                            is_required=item.is_required,
                            is_default_enabled=item.is_default_enabled,
                            is_draggable=item.is_draggable,
                            use_theme_color=item.use_theme_color,
                            config_json=item.config_json,
                        )
                        for item in source.sections.all()
                    ]
                )
        return Response(
            CvTemplateVersionAdminSerializer(version).data, status=status.HTTP_201_CREATED
        )

    def _version(self, template, version_pk):
        try:
            return template.versions.get(pk=version_pk)
        except CvTemplateVersion.DoesNotExist as error:
            raise ValidationError({'version': 'Unknown template version.'}) from error

    @action(detail=True, methods=['post'], url_path=r'versions/(?P<version_pk>\d+)/publish')
    def publish_version(self, request, public_id=None, version_pk=None):
        template = self.get_object()
        version = _call(
            publish_template_version, template=template, version=self._version(template, version_pk)
        )
        enqueue_template_snapshots(template)
        return Response(CvTemplateVersionAdminSerializer(version).data)

    @action(detail=True, methods=['post'], url_path=r'versions/(?P<version_pk>\d+)/retire')
    def retire_version(self, request, public_id=None, version_pk=None):
        template = self.get_object()
        version = _call(
            retire_template_version, template=template, version=self._version(template, version_pk)
        )
        return Response(CvTemplateVersionAdminSerializer(version).data)

    @action(detail=True, methods=['post'], url_path='snapshots/regenerate')
    def regenerate_snapshots(self, request, public_id=None):
        enqueue_template_snapshots(self.get_object())
        return Response({'status': 'queued'}, status=status.HTTP_202_ACCEPTED)


class AdminCvCategoryViewSet(AdminModelViewSet):
    serializer_class = CvCategoryAdminSerializer
    lookup_field = 'public_id'
    queryset = CvCategory.objects.all()


class AdminCvColorViewSet(AdminModelViewSet):
    serializer_class = CvColorAdminSerializer
    lookup_field = 'public_id'
    queryset = CvColor.objects.all()


class AdminCvBackgroundViewSet(AdminModelViewSet):
    serializer_class = CvBackgroundAdminSerializer
    lookup_field = 'public_id'
    queryset = CvAsset.objects.filter(
        kind=CvAsset.Kind.BACKGROUND,
        owner__isnull=True,
    ).order_by('created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data.get('file')
        if upload is None:
            raise ValidationError({'file': 'This field is required.'})
        can_publish = 'cv_template.publish' in effective_permission_codes(request.user)
        with transaction.atomic():
            asset = create_background_asset(
                upload=upload,
                title=serializer.validated_data.get('title', ''),
                is_active=can_publish,
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
        asset = self.get_object()
        asset.is_active = False
        asset.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SampleGenerationRejected(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = 'sample_generation_rejected'

    STATUS_BY_CODE = {
        'runtime_disabled': status.HTTP_503_SERVICE_UNAVAILABLE,
        'provider_not_configured': status.HTTP_503_SERVICE_UNAVAILABLE,
        'generation_in_progress': status.HTTP_409_CONFLICT,
    }

    def __init__(self, code):
        self.status_code = self.STATUS_BY_CODE.get(code, status.HTTP_400_BAD_REQUEST)
        super().__init__({'code': code}, code)


class AdminCvSampleContentViewSet(AdminModelViewSet):
    serializer_class = CvSampleContentAdminSerializer
    lookup_field = 'public_id'
    required_admin_permissions = {
        **AdminModelViewSet.required_admin_permissions,
        'preview': ['cv_template.view'],
        'publish': ['cv_template.publish'],
        'archive': ['cv_template.archive'],
        'generate': ['cv_template.create'],
    }
    FILTERS = {
        'position': 'position_profile__job_category__public_id',
        'locale': 'locale',
        'band': 'experience_band',
        'status': 'status',
    }

    def get_queryset(self):
        queryset = CvSampleContent.objects.select_related(
            'position_profile__job_category'
        ).order_by('-updated_at')
        params = self.request.query_params
        return queryset.filter(
            **{lookup: params[name] for name, lookup in self.FILTERS.items() if params.get(name)}
        )

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Xếp hàng sinh nội dung mẫu bằng AI; kết quả vào trạng thái chờ duyệt."""
        serializer = CvSampleGenerationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            generations = request_sample_generations(
                actor=request.user,
                profiles=data['position_public_ids'],
                locales=sorted(data['locales']),
                bands=sorted(data['experience_bands']),
            )
        except SampleGenerationUnavailable as error:
            raise SampleGenerationRejected(error.code) from error
        return Response(
            {
                'batch_id': generations[0].batch_id,
                'generations': CvSampleGenerationSerializer(generations, many=True).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=['post'])
    def preview(self, request, public_id=None):
        sample = self.get_object()
        try:
            template = CvTemplate.objects.get(public_id=request.data.get('template_public_id'))
        except CvTemplate.DoesNotExist as error:
            raise ValidationError({'template_public_id': 'Unknown template.'}) from error
        document = compose_cv_document(
            template=template,
            content_json=sample.content_json,
            theme_color=request.data.get('theme_color'),
        )
        return Response({'document': document})

    @action(detail=True, methods=['post'])
    def publish(self, request, public_id=None):
        sample = _call(publish_sample, sample=self.get_object(), actor=request.user)
        regenerate_all_template_snapshots.delay()
        return Response(self.get_serializer(sample).data)

    @action(detail=True, methods=['post'])
    def archive(self, request, public_id=None):
        sample = _call(archive_sample, sample=self.get_object())
        return Response(self.get_serializer(sample).data)


class AdminCvSampleGenerationViewSet(AdminModelViewSet):
    """Trạng thái các lượt sinh AI, lọc theo `?batch=`; chỉ đọc."""

    serializer_class = CvSampleGenerationSerializer
    lookup_field = 'public_id'
    http_method_names = ['get', 'head', 'options']

    def get_queryset(self):
        queryset = CvSampleGeneration.objects.select_related(
            'position_profile__job_category', 'sample'
        )
        if batch := self.request.query_params.get('batch'):
            queryset = queryset.filter(batch_id=batch)
        return queryset[:200]


class AdminCvPositionViewSet(AdminModelViewSet):
    """Cấu hình CV theo vị trí: bộ section, từ khóa; độ phủ nội dung; import/export JSON."""

    serializer_class = CvPositionProfileAdminSerializer
    lookup_field = 'public_id'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    required_admin_permissions = {
        **AdminModelViewSet.required_admin_permissions,
        'coverage': ['cv_template.view'],
        'export': ['cv_template.view'],
        'import_positions': ['cv_template.edit'],
    }

    def get_queryset(self):
        queryset = CvPositionProfile.objects.select_related('job_category').annotate(
            field_count=Count('fields')
        )
        if positions := self.request.query_params.get('position'):
            queryset = queryset.filter(job_category__public_id__in=positions.split(','))
        return queryset.order_by('sort_order', 'pk')

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

    @action(detail=False, methods=['get'])
    def export(self, request):
        return Response(export_positions(self.get_queryset()))

    @action(detail=False, methods=['post'], url_path='import')
    def import_positions(self, request):
        result = _call(import_positions, payload=request.data, actor=request.user)
        return Response(result, status=status.HTTP_201_CREATED)


class AdminCvPositionFieldViewSet(AdminModelViewSet):
    """Trường riêng của vị trí, lọc theo `?position=` (mã `JobCategory`)."""

    serializer_class = CvPositionFieldAdminSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        queryset = CvPositionField.objects.select_related('profile__job_category')
        if position := self.request.query_params.get('position'):
            queryset = queryset.filter(profile__job_category__public_id=position)
        return queryset.order_by('profile_id', 'sort_order', 'pk')
