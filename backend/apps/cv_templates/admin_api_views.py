from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Max
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin
from apps.cvs.services.composition import compose_cv_document
from apps.cvs.models import CvAsset
from apps.cvs.services import create_background_asset
from apps.jobs.models import JobCategory, JobCategoryLocalization

from .admin_api_serializers import (
    CvBackgroundAdminSerializer,
    CvCategoryAdminSerializer,
    CvColorAdminSerializer,
    CvContentBlueprintAdminSerializer,
    CvSampleContentAdminSerializer,
    CvTemplateAdminSerializer,
    CvTemplateLocalizationAdminSerializer,
    CvTemplateVersionAdminSerializer,
)
from .models import (
    CvCategory,
    CvColor,
    CvContentBlueprint,
    CvSampleContent,
    CvTemplate,
    CvTemplateLocalization,
    CvTemplateSection,
    CvTemplateVersion,
)
from .services import (
    activate_blueprint,
    archive_sample,
    publish_sample,
    publish_template_version,
    retire_template_version,
)
from .services.position_content import _content_from_blueprint
from .tasks import enqueue_template_snapshots, regenerate_all_template_snapshots


def _call(service, **kwargs):
    try:
        return service(**kwargs)
    except DjangoValidationError as error:
        raise ValidationError(
            error.message_dict if hasattr(error, 'message_dict') else error.messages
        ) from error


class AdminModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    pagination_class = None


class AdminCvTemplateViewSet(AdminModelViewSet):
    serializer_class = CvTemplateAdminSerializer
    lookup_field = 'public_id'
    queryset = CvTemplate.objects.prefetch_related('versions', 'localizations').order_by(
        'sort_order', 'name'
    )

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


class AdminCvTemplateLocalizationViewSet(AdminModelViewSet):
    serializer_class = CvTemplateLocalizationAdminSerializer
    queryset = CvTemplateLocalization.objects.select_related('template').order_by(
        'template_id', 'locale'
    )


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
        asset = self.get_object()
        asset.is_active = False
        asset.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminCvSampleContentViewSet(AdminModelViewSet):
    serializer_class = CvSampleContentAdminSerializer
    lookup_field = 'public_id'
    queryset = CvSampleContent.objects.select_related('job_category').order_by('-updated_at')

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
        sample = _call(publish_sample, sample=self.get_object())
        regenerate_all_template_snapshots.delay()
        return Response(self.get_serializer(sample).data)

    @action(detail=True, methods=['post'])
    def archive(self, request, public_id=None):
        sample = _call(archive_sample, sample=self.get_object())
        return Response(self.get_serializer(sample).data)


class AdminCvContentBlueprintViewSet(AdminModelViewSet):
    serializer_class = CvContentBlueprintAdminSerializer
    lookup_field = 'public_id'
    queryset = CvContentBlueprint.objects.order_by('locale', 'experience_level')

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['post'])
    def preview(self, request, public_id=None):
        blueprint = self.get_object()
        try:
            template = CvTemplate.objects.get(public_id=request.data.get('template_public_id'))
            position = JobCategory.objects.get(public_id=request.data.get('position_public_id'))
            position_name = JobCategoryLocalization.objects.get(
                category=position,
                locale=blueprint.locale,
                is_active=True,
            ).display_name
        except (
            CvTemplate.DoesNotExist,
            JobCategory.DoesNotExist,
            JobCategoryLocalization.DoesNotExist,
        ) as error:
            raise ValidationError(
                {'selection': 'Template/position localization is unavailable.'}
            ) from error
        content = _content_from_blueprint(blueprint, blueprint.locale, position_name)
        return Response({'document': compose_cv_document(template=template, content_json=content)})

    @action(detail=True, methods=['post'])
    def activate(self, request, public_id=None):
        blueprint = _call(activate_blueprint, blueprint=self.get_object())
        regenerate_all_template_snapshots.delay()
        return Response(self.get_serializer(blueprint).data)
