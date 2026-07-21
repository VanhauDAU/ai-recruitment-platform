"""Public V2 Template Catalog endpoints with a deliberately compact card contract."""

import json
from copy import deepcopy
from hashlib import sha256
from time import monotonic

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cvs.schemas import empty_content
from apps.cvs.services.composition import (
    CvCompositionError,
    compose_cv_document,
    finalize_preview_document,
)
from apps.jobs.models import JobCategory
from apps.sitecontent.selectors import default_locale_code, is_active_locale
from common.metrics import record_metric

from ...models import CvTemplate
from ...selectors import (
    active_cv_categories_queryset,
    active_cv_position_options_queryset,
    published_sample_contents_queryset,
    published_template_detail_queryset,
    published_template_queryset,
    related_published_templates,
)
from ...services import PositionContentUnavailable, resolve_position_content
from ..serializers.v2 import (
    CvCategorySerializer,
    CvPositionOptionSerializer,
    CvSampleContentCardSerializer,
    CvSampleContentDetailSerializer,
    CvTemplateCardSerializer,
    CvTemplateDetailSerializer,
)


def requested_locale(request):
    locale = request.query_params.get('locale', '').strip() or default_locale_code()
    if not is_active_locale(locale):
        raise ValidationError({'locale': 'Unknown or inactive locale.'})
    return locale


class PublicCatalogCacheMixin:
    cache_seconds = 300

    def cached_response(self, data):
        response = Response(data)
        digest = sha256(repr(data).encode('utf-8')).hexdigest()
        response['Cache-Control'] = f'public, max-age={self.cache_seconds}'
        response['ETag'] = f'"{digest}"'
        return response


class CvTemplateCatalogListView(PublicCatalogCacheMixin, generics.ListAPIView):
    serializer_class = CvTemplateCardSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return published_template_queryset(
            locale=requested_locale(self.request),
            category=self.request.query_params.get('category'),
            tag=self.request.query_params.get('tag'),
        ).order_by('-usage_count', 'sort_order', 'name')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response['Cache-Control'] = f'public, max-age={self.cache_seconds}'
        response['ETag'] = f'"{sha256(repr(response.data).encode("utf-8")).hexdigest()}"'
        return response


class CvTemplateCatalogDetailView(PublicCatalogCacheMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get_template(self, slug, locale):
        try:
            return published_template_detail_queryset(locale=locale).get(slug=slug)
        except CvTemplate.DoesNotExist as error:
            raise Http404 from error

    def get(self, request, slug):
        template = self.get_template(slug, requested_locale(request))
        return self.cached_response(CvTemplateDetailSerializer(template).data)


class CvTemplateRelatedListView(CvTemplateCatalogDetailView):
    def get(self, request, slug):
        locale = requested_locale(request)
        template = self.get_template(slug, locale)
        return self.cached_response(
            CvTemplateCardSerializer(
                related_published_templates(template, locale=locale), many=True
            ).data
        )


class CvCategoryCatalogListView(PublicCatalogCacheMixin, generics.ListAPIView):
    serializer_class = CvCategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_cv_categories_queryset(self.request.query_params.get('type'))

    def list(self, request, *args, **kwargs):
        return self.cached_response(self.get_serializer(self.get_queryset(), many=True).data)


class CvSampleContentCatalogListView(PublicCatalogCacheMixin, generics.ListAPIView):
    serializer_class = CvSampleContentCardSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return published_sample_contents_queryset(
            locale=self.request.query_params.get('locale'),
            experience_level=self.request.query_params.get('experience_level'),
        )

    def list(self, request, *args, **kwargs):
        return self.cached_response(self.get_serializer(self.get_queryset(), many=True).data)


class CvSampleContentCatalogDetailView(PublicCatalogCacheMixin, generics.RetrieveAPIView):
    serializer_class = CvSampleContentDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'public_id'

    def get_queryset(self):
        return published_sample_contents_queryset()

    def retrieve(self, request, *args, **kwargs):
        return self.cached_response(self.get_serializer(self.get_object()).data)


class CvPositionOptionListView(PublicCatalogCacheMixin, generics.ListAPIView):
    serializer_class = CvPositionOptionSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_cv_position_options_queryset(
            self.request.query_params.get('q', '').strip(),
            locale=requested_locale(self.request),
            experience_level=self.request.query_params.get(
                'experience_level', 'unspecified'
            ).strip(),
        )

    def list(self, request, *args, **kwargs):
        return self.cached_response(self.get_serializer(self.get_queryset(), many=True).data)


class CvPositionPreviewView(PublicCatalogCacheMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        started_at = monotonic()
        public_id = request.query_params.get('position_public_id', '').strip()
        locale = requested_locale(request)
        experience_level = request.query_params.get('experience_level', 'unspecified').strip()
        source = request.query_params.get('source', 'sample').strip()
        template_public_id = request.query_params.get('template_public_id', '').strip()
        theme_color = request.query_params.get('theme_color', '').strip().upper()
        if source not in {'sample', 'blank'}:
            raise ValidationError({'source': 'Use sample or blank.'})
        if source == 'sample' and not public_id:
            raise ValidationError({'position_public_id': 'This query parameter is required.'})

        if source == 'blank':
            resolved = {
                'position_public_id': None,
                'name_vi': '',
                'locale': locale,
                'experience_level': experience_level,
                'source': 'blank',
                'sample_content_public_id': None,
                'schema_version': 1,
                'content_json': empty_content(locale),
            }
        else:
            try:
                position = active_cv_position_options_queryset(
                    locale=locale,
                    experience_level=experience_level,
                ).get(public_id=public_id)
            except JobCategory.DoesNotExist as error:
                raise Http404 from error
            try:
                resolved = resolve_position_content(
                    position=position,
                    locale=locale,
                    experience_level=experience_level,
                )
            except PositionContentUnavailable as error:
                raise ValidationError({'locale': str(error)}) from error

        # Compatibility: consumers that do not request a template keep the
        # renderer-neutral content-only response.
        if not template_public_id:
            return self.cached_response(resolved)

        try:
            template = (
                CvTemplate.objects.select_related(
                    'current_published_version',
                )
                .prefetch_related(
                    'current_published_version__sections__section_definition',
                )
                .get(public_id=template_public_id)
            )
        except CvTemplate.DoesNotExist as error:
            raise Http404 from error

        if (
            theme_color
            and not template.color_links.filter(
                color__hex_code__iexact=theme_color,
                color__is_active=True,
            ).exists()
        ):
            raise ValidationError({'theme_color': 'Color is not available for this template.'})

        content_digest = sha256(
            json.dumps(
                resolved['content_json'],
                ensure_ascii=False,
                sort_keys=True,
                separators=(',', ':'),
            ).encode('utf-8')
        ).hexdigest()
        version = template.current_published_version
        cache_key = ':'.join(
            [
                'cv-position-preview-v2',
                str(version.pk if version else 'missing'),
                locale,
                public_id or 'blank',
                experience_level,
                content_digest,
            ]
        )
        base_document = cache.get(cache_key)
        cache_hit = base_document is not None
        if base_document is None:
            try:
                base_document = compose_cv_document(
                    template=template,
                    content_json=resolved['content_json'],
                )
            except (CvCompositionError, DjangoValidationError) as error:
                raise ValidationError({'template_public_id': str(error)}) from error
            cache.set(cache_key, base_document, timeout=self.cache_seconds)

        document = finalize_preview_document(
            deepcopy(base_document),
            actor=request.user,
            theme_color=theme_color or None,
        )
        revision = sha256(
            json.dumps(
                {
                    'document': base_document,
                    'renderer_key': version.renderer_key,
                    'renderer_version': version.renderer_version,
                },
                ensure_ascii=False,
                sort_keys=True,
                separators=(',', ':'),
            ).encode('utf-8')
        ).hexdigest()
        data = {
            **resolved,
            'document': document,
            'renderer': {
                'key': version.renderer_key,
                'version': version.renderer_version,
                'schema_version': version.schema_version,
                'capabilities': version.capabilities,
            },
            'revision': revision,
        }
        response = Response(data)
        if request.user.is_authenticated:
            response['Cache-Control'] = 'private, no-store'
        else:
            response['Cache-Control'] = f'public, max-age={self.cache_seconds}'
            response['ETag'] = f'"{revision}"'
        record_metric('cv_preview_cache_hit', int(cache_hit), source=source, locale=locale)
        record_metric(
            'cv_preview_latency_ms',
            round((monotonic() - started_at) * 1000, 2),
            source=source,
            locale=locale,
            cache='hit' if cache_hit else 'miss',
        )
        return response
