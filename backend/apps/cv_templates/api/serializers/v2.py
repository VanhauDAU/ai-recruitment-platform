"""Public, renderer-safe serializer contracts for the V2 template catalogue."""

from rest_framework import serializers

from apps.jobs.models import JobCategory
from common.media_storage import media_url_from_value

from ...models import CvCategory, CvSampleContent, CvTemplate


def _catalog_groups(template):
    links = getattr(template, 'catalog_category_links', [])
    categories = []
    tags = []
    for link in links:
        category = link.category
        item = {
            'public_id': category.public_id,
            'slug': category.slug,
            'name': category.name,
            'type': category.category_type,
        }
        (tags if category.category_type == CvCategory.CategoryType.FEATURE else categories).append(
            item
        )
    return categories, tags


def _catalog_colors(template, request=None):
    return [
        {
            'public_id': link.color.public_id,
            'name': link.color.name,
            'slug': link.color.slug,
            'hex_code': link.color.hex_code,
            'thumbnail_url': media_url_from_value(link.thumbnail_url, request=request),
            'preview_url': media_url_from_value(
                link.preview_url or link.thumbnail_url, request=request
            ),
            'is_default': link.is_default,
        }
        for link in getattr(template, 'catalog_color_links', [])
    ]


def _default_color(colors):
    return next((item for item in colors if item['is_default']), colors[0] if colors else {})


class CvTemplateCardSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    colors = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()

    class Meta:
        model = CvTemplate
        fields = [
            'public_id',
            'slug',
            'display_name',
            'description',
            'thumbnail_url',
            'is_premium',
            'colors',
            'categories',
            'tags',
        ]
        read_only_fields = fields

    # Giá trị theo ngôn ngữ do `published_template_queryset` annotate.
    def get_display_name(self, template):
        return template.catalog_display_name

    def get_description(self, template):
        return template.catalog_description

    def get_colors(self, template):
        return _catalog_colors(template, self.context.get('request'))

    def get_thumbnail_url(self, template):
        """Ảnh của màu mặc định (thumbnail, thiếu thì dùng ảnh preview)."""
        color = _default_color(self.get_colors(template))
        return color.get('thumbnail_url') or color.get('preview_url', '')

    def get_categories(self, template):
        return _catalog_groups(template)[0]

    def get_tags(self, template):
        return _catalog_groups(template)[1]


class CvTemplateDetailSerializer(CvTemplateCardSerializer):
    preview_url = serializers.SerializerMethodField()
    seo_title = serializers.CharField(source='catalog_seo_title', read_only=True)
    seo_description = serializers.CharField(source='catalog_seo_description', read_only=True)
    renderer = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()

    class Meta(CvTemplateCardSerializer.Meta):
        fields = CvTemplateCardSerializer.Meta.fields + [
            'preview_url',
            'seo_title',
            'seo_description',
            'renderer',
            'sections',
        ]

    def get_preview_url(self, template):
        return _default_color(self.get_colors(template)).get('preview_url', '')

    def get_renderer(self, template):
        version = template.current_published_version
        return {
            'key': version.renderer_key,
            'version': version.renderer_version,
            'schema_version': version.schema_version,
            'capabilities': version.capabilities,
        }

    def get_sections(self, template):
        sections = getattr(template.current_published_version, 'catalog_sections', [])
        return [
            {
                'section_key': item.section_definition.section_key,
                'display_name': item.section_definition.display_name,
                'region_key': item.region_key,
                'default_order': item.default_order,
                'is_required': item.is_required,
            }
            for item in sorted(sections, key=lambda item: (item.region_key, item.default_order))
        ]


class CvCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CvCategory
        fields = ['public_id', 'category_type', 'name', 'slug', 'description']
        read_only_fields = fields


class CvSampleContentCardSerializer(serializers.ModelSerializer):
    position_public_id = serializers.CharField(
        source='position_profile.job_category.public_id', read_only=True
    )
    position_slug = serializers.CharField(
        source='position_profile.job_category.slug', read_only=True
    )
    position_name = serializers.CharField(
        source='position_profile.job_category.name', read_only=True
    )

    class Meta:
        model = CvSampleContent
        fields = [
            'public_id',
            'title',
            'locale',
            'experience_band',
            'position_public_id',
            'position_slug',
            'position_name',
        ]
        read_only_fields = fields


class CvPositionOptionSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    name_vi = serializers.SerializerMethodField()

    class Meta:
        model = JobCategory
        fields = ['public_id', 'slug', 'display_name', 'name_vi']
        read_only_fields = fields

    def get_display_name(self, obj):
        localizations = getattr(obj, 'cv_picker_localizations', [])
        return localizations[0].display_name if localizations else obj.name

    def get_name_vi(self, obj):
        localizations = getattr(obj, 'cv_picker_vi_localizations', [])
        return localizations[0].display_name if localizations else obj.name
