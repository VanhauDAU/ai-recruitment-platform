from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.permissions import require_admin_permission
from apps.cvs.models import CvAsset
from apps.jobs.models import JobCategory
from common.media_storage import media_url_from_value

from ...models import (
    CvCategory,
    CvColor,
    CvLanguage,
    CvPositionField,
    CvPositionProfile,
    CvSampleContent,
    CvSampleGeneration,
    CvTemplate,
    CvTemplateCategoryLink,
    CvTemplateVersion,
    ExperienceBand,
)
from ...renderers import layout_registry

PROTECTED_LIFECYCLE_FIELDS = {
    'CvTemplate': ('lifecycle_status', 'current_published_version'),
    'CvCategory': ('is_active',),
    'CvColor': ('is_active',),
    'CvAsset': ('is_active',),
    'CvSampleContent': ('status', 'published_at'),
}


def _is_published_state(field, value):
    if field == 'is_active':
        return value is True
    if field in {'status', 'lifecycle_status'}:
        return value == 'published'
    return value is not None


class LifecycleFieldGuardMixin:
    """Protect public lifecycle transitions independently from edit access."""

    def _lifecycle_fields(self):
        return PROTECTED_LIFECYCLE_FIELDS.get(self.Meta.model.__name__, ())

    def validate(self, attrs):
        request = self.context.get('request')
        if request is None:
            return super().validate(attrs)

        for field in self._lifecycle_fields():
            if field not in attrs:
                continue
            after = attrs[field]
            if self.instance is None:
                if _is_published_state(field, after):
                    require_admin_permission(request.user, 'cv_template.publish')
                continue

            # Bật/tắt hiển thị hay lưu trữ đều là quyền phát hành (CVT-4).
            if getattr(self.instance, field) != after:
                require_admin_permission(request.user, 'cv_template.publish')
        return super().validate(attrs)


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

    def get_sections(self, obj):
        return [
            {
                'section_key': section.section_definition.section_key,
                'region_key': section.region_key,
                'is_required': section.is_required,
                'is_default_enabled': section.is_default_enabled,
            }
            for section in sorted(obj.sections.all(), key=lambda item: item.default_order)
        ]

    def get_published_by_name(self, obj):
        user = obj.published_by
        return (getattr(user, 'full_name', '') or user.email) if user else ''


class CvTemplateAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
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

    def get_colors(self, obj):
        return [
            {
                'public_id': link.color.public_id,
                'name': link.color.name,
                'hex_code': link.color.hex_code,
                'is_default': link.is_default,
            }
            for link in self._links(obj)
        ]

    def get_thumbnail_url(self, obj):
        link = next((link for link in self._links(obj) if link.is_default), None)
        if link is None or not link.thumbnail_url:
            return ''
        return media_url_from_value(link.thumbnail_url, request=self.context.get('request'))

    def _save_categories(self, template, categories):
        if categories is None:
            return
        template.category_links.exclude(category__in=categories).delete()
        existing = set(template.category_links.values_list('category_id', flat=True))
        CvTemplateCategoryLink.objects.bulk_create(
            [
                CvTemplateCategoryLink(template=template, category=category)
                for category in categories
                if category.pk not in existing
            ]
        )

    def create(self, validated_data):
        categories = validated_data.pop('categories', None)
        template = super().create(validated_data)
        self._save_categories(template, categories)
        return template

    def update(self, instance, validated_data):
        categories = validated_data.pop('categories', None)
        template = super().update(instance, validated_data)
        self._save_categories(template, categories)
        return template


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


class CvCategoryAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    # Số mẫu đang dùng (annotate ở viewset); mục đang dùng không xóa được.
    template_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CvCategory
        fields = '__all__'
        read_only_fields = ['public_id', 'created_at', 'updated_at']


class CvColorAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    # Số mẫu đang dùng (annotate ở viewset); mục đang dùng không xóa được.
    template_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CvColor
        fields = '__all__'
        read_only_fields = ['public_id', 'created_at', 'updated_at']


class CvBackgroundAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    file = serializers.FileField(write_only=True, required=False)
    url = serializers.SerializerMethodField()

    class Meta:
        model = CvAsset
        fields = [
            'public_id',
            'title',
            'file',
            'content_type',
            'size_bytes',
            'width',
            'height',
            'is_active',
            'url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'public_id',
            'content_type',
            'size_bytes',
            'width',
            'height',
            'url',
            'created_at',
            'updated_at',
        ]

    def get_url(self, obj):
        from django.urls import reverse

        path = reverse('cv-v2-asset-content', kwargs={'asset_public_id': obj.public_id})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path


class PositionProfileField(serializers.SlugRelatedField):
    """Nhận và trả mã `JobCategory` thay cho khóa nội bộ của `CvPositionProfile`."""

    def to_representation(self, obj):
        return obj.job_category.public_id


class CvSampleContentAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    LOCKED_FIELD_NAMES = {'position_profile': 'position_public_id'}

    # Mã `JobCategory` của vị trí (null = nội dung chung, có thể chứa `{position}`).
    position_public_id = PositionProfileField(
        source='position_profile',
        slug_field='job_category__public_id',
        queryset=CvPositionProfile.objects.select_related('job_category'),
        allow_null=True,
        required=False,
    )
    position_name = serializers.CharField(
        source='position_profile.job_category.name', read_only=True, default=''
    )

    class Meta:
        model = CvSampleContent
        fields = [
            'public_id',
            'position_public_id',
            'position_name',
            'locale',
            'experience_band',
            'title',
            'content_json',
            'schema_version',
            'status',
            'origin',
            'reviewed_at',
            'published_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'public_id',
            'status',
            'origin',
            'reviewed_at',
            'published_at',
            'created_at',
            'updated_at',
        ]
        # Ràng buộc unique chỉ áp cho bản đang xuất bản (có điều kiện); validator
        # tự sinh của DRF bỏ qua điều kiện và chặn nhầm bản nháp. Bản mới luôn là
        # nháp, còn vị trí/ngôn ngữ/mức kinh nghiệm không đổi được sau khi tạo.
        validators = []

    def validate(self, attrs):
        instance = self.instance
        if instance is not None:
            for field in ('position_profile', 'locale', 'experience_band'):
                if field in attrs and attrs[field] != getattr(instance, field):
                    raise serializers.ValidationError(
                        {
                            self.LOCKED_FIELD_NAMES.get(field, field): (
                                'Không đổi được sau khi tạo; hãy tạo nội dung mới.'
                            )
                        }
                    )
        locale = attrs.get('locale', instance.locale if instance else None)
        content = attrs.get('content_json', instance.content_json if instance else {})
        if content.get('locale') != locale:
            raise serializers.ValidationError(
                {'content_json': 'content_json.locale must match locale.'}
            )
        return super().validate(attrs)


def _model_clean(instance, attrs):
    """Chạy `clean()` của model trên bản đã gộp thay đổi để lỗi trả về dạng 400."""
    for name, value in attrs.items():
        setattr(instance, name, value)
    try:
        instance.clean()
    except DjangoValidationError as error:
        raise serializers.ValidationError(error.message_dict) from error
    return attrs


class CvPositionProfileAdminSerializer(serializers.ModelSerializer):
    position_public_id = serializers.SlugRelatedField(
        source='job_category',
        slug_field='public_id',
        queryset=JobCategory.objects.filter(category_type=JobCategory.CategoryType.SPECIALIZATION),
    )
    position_name = serializers.CharField(source='job_category.name', read_only=True)
    industry_name = serializers.CharField(
        source='job_category.parent.name', read_only=True, default=''
    )
    field_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CvPositionProfile
        fields = [
            'public_id',
            'position_public_id',
            'position_name',
            'industry_name',
            'section_preset',
            'keywords',
            'is_active',
            'sort_order',
            'field_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['public_id', 'created_at', 'updated_at']

    def validate(self, attrs):
        if self.instance is not None and attrs.get('job_category', self.instance.job_category) != (
            self.instance.job_category
        ):
            raise serializers.ValidationError({'position_public_id': 'Không đổi được vị trí.'})
        if (
            self.instance is None
            and CvPositionProfile.objects.filter(job_category=attrs['job_category']).exists()
        ):
            raise serializers.ValidationError({'position_public_id': 'Vị trí đã có cấu hình CV.'})
        instance = self.instance or CvPositionProfile()
        return _model_clean(instance, {**attrs})


class CvPositionFieldAdminSerializer(serializers.ModelSerializer):
    position_public_id = PositionProfileField(
        source='profile',
        slug_field='job_category__public_id',
        queryset=CvPositionProfile.objects.select_related('job_category'),
    )

    class Meta:
        model = CvPositionField
        fields = [
            'public_id',
            'position_public_id',
            'key',
            'label_vi',
            'label_en',
            'placeholder_vi',
            'placeholder_en',
            'field_type',
            'options',
            'maps_to',
            'is_required_hint',
            'is_active',
            'sort_order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['public_id', 'created_at', 'updated_at']

    def validate(self, attrs):
        if (
            self.instance is not None
            and 'profile' in attrs
            and attrs['profile'] != self.instance.profile
        ):
            raise serializers.ValidationError(
                {'position_public_id': 'Không chuyển trường sang vị trí khác.'}
            )
        profile = attrs.get('profile', getattr(self.instance, 'profile', None))
        key = attrs.get('key', getattr(self.instance, 'key', None))
        duplicate = CvPositionField.objects.filter(profile=profile, key=key)
        if self.instance is not None:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError({'key': 'Khóa đã có trong vị trí này.'})
        current = {}
        if self.instance is not None:
            current = {
                name: getattr(self.instance, name) for name in ('field_type', 'options', 'maps_to')
            }
        _model_clean(
            CvPositionField(), {**current, **{k: v for k, v in attrs.items() if k != 'profile'}}
        )
        return attrs


class CvSampleGenerationRequestSerializer(serializers.Serializer):
    position_public_ids = serializers.ListField(
        child=serializers.CharField(max_length=50), min_length=1, max_length=16
    )
    locales = serializers.MultipleChoiceField(choices=CvLanguage.choices)
    experience_bands = serializers.MultipleChoiceField(choices=ExperienceBand.choices)

    def validate_position_public_ids(self, value):
        wanted = list(dict.fromkeys(value))
        profiles = list(
            CvPositionProfile.objects.filter(
                job_category__public_id__in=wanted, is_active=True
            ).prefetch_related('fields')
        )
        if len(profiles) != len(wanted):
            raise serializers.ValidationError('Có vị trí không tồn tại hoặc chưa bật cho CV.')
        return profiles

    def validate(self, attrs):
        if not attrs['locales'] or not attrs['experience_bands']:
            raise serializers.ValidationError('Chọn ít nhất một ngôn ngữ và một nhóm kinh nghiệm.')
        return attrs


class CvSampleGenerationSerializer(serializers.ModelSerializer):
    position_public_id = serializers.CharField(
        source='position_profile.job_category.public_id', read_only=True
    )
    sample_public_id = serializers.CharField(
        source='sample.public_id', read_only=True, default=None
    )

    class Meta:
        model = CvSampleGeneration
        fields = [
            'public_id',
            'batch_id',
            'position_public_id',
            'locale',
            'experience_band',
            'status',
            'failure_code',
            'sample_public_id',
            'created_at',
            'finished_at',
        ]
        read_only_fields = fields
