"""Admin contracts for templates, their versions and the design wizard steps."""

from rest_framework import serializers

from common.storage.media import media_url_from_value

from ...domain.renderers import layout_registry
from ...models import CvCategory, CvLanguage, CvTemplate, CvTemplateVersion, ExperienceBand


class CvTemplateVersionAdminSerializer(serializers.ModelSerializer):
    sections = serializers.SerializerMethodField()
    published_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CvTemplateVersion
        exclude = ['template', 'created_by', 'published_by']
        read_only_fields = [
            'version_number',
            'version_status',
            'published_at',
            'retired_at',
            'created_at',
        ]

    def get_sections(self, obj) -> list[dict]:
        return [
            {
                'section_key': section.section_definition.section_key,
                'region_key': section.region_key,
                'is_required': section.is_required,
                'is_default_enabled': section.is_default_enabled,
            }
            for section in sorted(obj.sections.all(), key=lambda item: item.default_order)
        ]

    def get_published_by_name(self, obj) -> str:
        user = obj.published_by
        return (getattr(user, 'full_name', '') or user.email) if user else ''


class CvTemplateAdminSerializer(serializers.ModelSerializer):
    versions = CvTemplateVersionAdminSerializer(many=True, read_only=True)
    current_published_version_id = serializers.IntegerField(read_only=True)
    category_public_ids = serializers.SlugRelatedField(
        source='categories',
        slug_field='public_id',
        many=True,
        required=False,
        queryset=CvCategory.objects.all(),
    )
    colors = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = CvTemplate
        fields = [
            'public_id',
            'name',
            'slug',
            'display_name_vi',
            'display_name_en',
            'description_vi',
            'description_en',
            'seo_title_vi',
            'seo_title_en',
            'seo_description_vi',
            'seo_description_en',
            'is_premium',
            'sort_order',
            'usage_count',
            'lifecycle_status',
            'current_published_version_id',
            'category_public_ids',
            'colors',
            'thumbnail_url',
            'versions',
        ]
        read_only_fields = [
            'public_id',
            'usage_count',
            'lifecycle_status',
            'current_published_version_id',
        ]

    def _links(self, obj):
        return sorted(obj.color_links.all(), key=lambda link: link.sort_order)

    def get_colors(self, obj) -> list[dict]:
        return [
            {
                'public_id': link.color.public_id,
                'name': link.color.name,
                'hex_code': link.color.hex_code,
                'is_default': link.is_default,
            }
            for link in self._links(obj)
        ]

    def get_thumbnail_url(self, obj) -> str:
        link = next((link for link in self._links(obj) if link.is_default), None)
        if link is None or not link.thumbnail_url:
            return ''
        return media_url_from_value(link.thumbnail_url, request=self.context.get('request'))


class TemplateVersionConfigSerializer(serializers.Serializer):
    """Một bước của wizard: layout, độ rộng cột, phong cách, section theo vùng."""

    renderer_key = serializers.ChoiceField(choices=sorted(layout_registry()), required=False)
    widths = serializers.DictField(
        child=serializers.IntegerField(min_value=10, max_value=100), required=False
    )
    style = serializers.DictField(required=False)
    sections = serializers.ListField(child=serializers.DictField(), required=False, max_length=40)


class TemplateLayoutSerializer(serializers.Serializer):
    renderer_key = serializers.ChoiceField(
        choices=sorted(layout_registry()), required=False, allow_blank=True
    )


class TemplateColorsSerializer(serializers.Serializer):
    color_public_ids = serializers.ListField(
        child=serializers.CharField(max_length=50), min_length=1, max_length=12
    )
    default_color_public_id = serializers.CharField(max_length=50)


class TemplatePreviewSerializer(serializers.Serializer):
    version_id = serializers.IntegerField(required=False)
    position_public_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    experience_band = serializers.ChoiceField(
        choices=ExperienceBand.choices, default=ExperienceBand.JUNIOR
    )
    locale = serializers.ChoiceField(choices=CvLanguage.choices, default=CvLanguage.VI)
    theme_color = serializers.RegexField(r'^#[0-9A-Fa-f]{6}$', required=False)
