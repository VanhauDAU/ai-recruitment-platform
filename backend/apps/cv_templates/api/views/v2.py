"""Public V2 Template Catalog endpoints with a deliberately compact card contract."""

import json
from copy import deepcopy
from hashlib import sha256
from time import monotonic

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
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
from common.metrics import record_metric

from ...demo_identity import with_demo_identity
from ...models import (
    DEFAULT_CV_LANGUAGE,
    DEFAULT_EXPERIENCE_BAND,
    CvLanguage,
    CvTemplate,
    ExperienceBand,
)
from ...selectors import (
    active_cv_categories_queryset,
    active_cv_position_options_queryset,
    active_position_profile,
    published_sample_contents_queryset,
    published_template_detail_queryset,
    published_template_queryset,
    related_published_templates,
)
from ...services import (
    PositionContentUnavailable,
    position_details_section,
    resolve_position_content,
)
from ..serializers.v2 import (
    CvCategorySerializer,
    CvPositionOptionSerializer,
    CvSampleContentCardSerializer,
    CvTemplateCardSerializer,
    CvTemplateDetailSerializer,
)


def requested_locale(request):
    locale = request.query_params.get('locale', '').strip() or DEFAULT_CV_LANGUAGE
    if locale not in CvLanguage.values:
        raise ValidationError({'locale': 'Unsupported locale.'})
    return locale


def requested_experience_band(request, *, default=DEFAULT_EXPERIENCE_BAND):
    band = request.query_params.get('experience_band', '').strip() or default
    if band and band not in ExperienceBand.values:
        raise ValidationError({'experience_band': 'Unsupported experience band.'})
    return band


# Kho mẫu công khai: trình duyệt/CDN được lưu nhưng phải hỏi lại máy chủ mỗi lần
# (ETag → 304). Admin ẩn, hiện hay xuất bản mẫu có hiệu lực ngay; trước đây
# `max-age=300` khiến danh sách cũ (kèm ảnh mẫu đã thay) còn hiển thị 5 phút.
PUBLIC_CATALOG_CACHE_CONTROL = 'public, no-cache'


def revalidated_response(request, data, etag=None):
    etag = f'"{etag or sha256(repr(data).encode("utf-8")).hexdigest()}"'
    headers = {'Cache-Control': PUBLIC_CATALOG_CACHE_CONTROL, 'ETag': etag}
    if etag in request.headers.get('If-None-Match', ''):
        return Response(status=304, headers=headers)
    return Response(data, headers=headers)


class PublicCatalogCacheMixin:
    # Thời gian giữ document xem trước trong cache máy chủ (Redis).
    cache_seconds = 300

    def cached_response(self, data):
        return revalidated_response(self.request, data)


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
        return revalidated_response(request, super().list(request, *args, **kwargs).data)


@extend_schema(
    summary='Chi tiết một mẫu CV trong catalogue công khai',
    responses={200: CvTemplateDetailSerializer},
    tags=['cv-templates'],
)
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


@extend_schema(
    summary='Các mẫu CV liên quan',
    responses={200: CvTemplateCardSerializer(many=True)},
    tags=['cv-templates'],
)
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
            experience_band=requested_experience_band(self.request, default=None),
        )

    def list(self, request, *args, **kwargs):
        return self.cached_response(self.get_serializer(self.get_queryset(), many=True).data)


class CvPositionOptionListView(PublicCatalogCacheMixin, generics.ListAPIView):
    serializer_class = CvPositionOptionSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_cv_position_options_queryset(
            self.request.query_params.get('q', '').strip(),
            locale=requested_locale(self.request),
        )

    def list(self, request, *args, **kwargs):
        return self.cached_response(self.get_serializer(self.get_queryset(), many=True).data)


@extend_schema(
    summary='Khung mục thông tin chuyên môn (trường riêng) của một vị trí',
    parameters=[OpenApiParameter('position_public_id', str), OpenApiParameter('locale', str)],
    responses={200: OpenApiTypes.OBJECT},
    tags=['cv-templates'],
)
class CvPositionDetailsView(PublicCatalogCacheMixin, APIView):
    """Editor dùng khi ứng viên đổi vị trí: thay section `position_details` theo vị trí mới."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        public_id = request.query_params.get('position_public_id', '').strip()
        locale = requested_locale(request)
        profile = active_position_profile(public_id) if public_id else None
        section = position_details_section(profile, locale) if profile else None
        return self.cached_response({'position_public_id': public_id, 'section': section})


@extend_schema(
    summary='Xem trước nội dung mẫu theo vị trí công việc',
    parameters=[
        OpenApiParameter('position_public_id', str),
        OpenApiParameter('experience_band', str, enum=ExperienceBand.values),
        OpenApiParameter('source', str, description='sample | blank'),
        OpenApiParameter('template_public_id', str),
        OpenApiParameter('theme_color', str),
    ],
    responses={200: OpenApiTypes.OBJECT},
    tags=['cv-templates'],
)
class CvPositionPreviewView(PublicCatalogCacheMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        started_at = monotonic()
        public_id = request.query_params.get('position_public_id', '').strip()
        locale = requested_locale(request)
        experience_band = requested_experience_band(request)
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
                'experience_band': experience_band,
                'source': 'blank',
                'sample_content_public_id': None,
                'schema_version': 1,
                'content_json': empty_content(locale),
            }
        else:
            try:
                position = active_cv_position_options_queryset(locale=locale).get(
                    public_id=public_id
                )
            except JobCategory.DoesNotExist as error:
                raise Http404 from error
            try:
                resolved = resolve_position_content(
                    position=position,
                    locale=locale,
                    experience_band=experience_band,
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
                experience_band,
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

        preview = deepcopy(base_document)
        if source == 'sample' and not request.user.is_authenticated:
            # Khách xem mẫu giống ảnh catalogue; người đăng nhập thấy danh tính của mình.
            preview['content_json'] = with_demo_identity(preview['content_json'], locale)
        document = finalize_preview_document(
            preview,
            actor=request.user,
            theme_color=theme_color or None,
        )
        revision = sha256(
            json.dumps(
                {
                    'document': document,
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
        if request.user.is_authenticated:
            response = Response(data, headers={'Cache-Control': 'private, no-store'})
        else:
            response = revalidated_response(request, data, etag=revision)
        record_metric('cv_preview_cache_hit', int(cache_hit), source=source, locale=locale)
        record_metric(
            'cv_preview_latency_ms',
            round((monotonic() - started_at) * 1000, 2),
            source=source,
            locale=locale,
            cache='hit' if cache_hit else 'miss',
        )
        return response
