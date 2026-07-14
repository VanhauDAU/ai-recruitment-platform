"""Public, renderer-safe serializer contracts for the V2 template catalogue."""

from rest_framework import serializers

from .models import CvCategory, CvSampleContent, CvTemplate


def _localized(template):
    return (getattr(template, 'catalog_localizations', []) or [None])[0]


def _catalog_groups(template):
    links = getattr(template, 'catalog_category_links', [])
    categories = []
    tags = []
    for link in links:
        category = link.category
        item = {'public_id': category.public_id, 'slug': category.slug, 'name': category.name, 'type': category.category_type}
        (tags if category.category_type == CvCategory.CategoryType.FEATURE else categories).append(item)
    return categories, tags


def _catalog_colors(template):
    return [
        {
            'public_id': link.color.public_id,
            'name': link.color.name,
            'slug': link.color.slug,
            'hex_code': link.color.hex_code,
            'thumbnail_url': link.thumbnail_url or template.thumbnail_url,
            'preview_url': link.preview_url or link.thumbnail_url or template.preview_url or template.thumbnail_url,
            'is_default': link.is_default,
        }
        for link in getattr(template, 'catalog_color_links', [])
    ]


class CvTemplateCardSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    theme_color = serializers.SerializerMethodField()
    color_variants = serializers.SerializerMethodField()
    colors = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()

    class Meta:
        model = CvTemplate
        fields = [
            'public_id', 'slug', 'display_name', 'description', 'thumbnail_url',
            'is_premium', 'theme_color', 'color_variants', 'colors', 'categories', 'tags',
        ]
        read_only_fields = fields

    def get_display_name(self, template):
        localization = _localized(template)
        return localization.display_name if localization else template.name

    def get_description(self, template):
        localization = _localized(template)
        return localization.description if localization else template.description

    def get_theme_color(self, template):
        colors = _catalog_colors(template)
        default = next((item for item in colors if item['is_default']), colors[0] if colors else None)
        return default['hex_code'] if default else template.current_published_version.default_style_json.get('theme_color', '#00A66A')

    def get_color_variants(self, template):
        return [item['hex_code'] for item in _catalog_colors(template)] or [self.get_theme_color(template)]

    def get_colors(self, template):
        return _catalog_colors(template)

    def get_categories(self, template):
        return _catalog_groups(template)[0]

    def get_tags(self, template):
        return _catalog_groups(template)[1]


class CvTemplateDetailSerializer(CvTemplateCardSerializer):
    preview_url = serializers.CharField(read_only=True)
    renderer = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()

    class Meta(CvTemplateCardSerializer.Meta):
        fields = CvTemplateCardSerializer.Meta.fields + ['preview_url', 'renderer', 'sections']

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
    job_category_name = serializers.CharField(source='job_category.name', read_only=True)
    job_category_slug = serializers.CharField(source='job_category.slug', read_only=True)
    position_name_vi = serializers.SerializerMethodField()
    position_name = serializers.SerializerMethodField()

    def get_position_name_vi(self, obj):
        return obj.position_name_vi or (obj.job_category.name if obj.job_category_id else obj.title)

    def get_position_name(self, obj):
        content = obj.content_json if isinstance(obj.content_json, dict) else {}
        personal_info = content.get('personal_info', {})
        if isinstance(personal_info, dict) and personal_info.get('headline'):
            return personal_info['headline']
        return obj.job_category.name if obj.job_category_id else obj.title

    class Meta:
        model = CvSampleContent
        fields = [
            'public_id', 'title', 'locale', 'experience_level', 'job_category_name',
            'job_category_slug', 'position_name_vi', 'position_name',
        ]
        read_only_fields = fields


class CvSampleContentDetailSerializer(CvSampleContentCardSerializer):
    class Meta(CvSampleContentCardSerializer.Meta):
        fields = CvSampleContentCardSerializer.Meta.fields + ['content_json', 'schema_version']
        read_only_fields = fields
