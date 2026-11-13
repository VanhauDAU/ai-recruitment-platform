from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.permissions import require_admin_permission
from apps.cvs.models import CvAsset
from apps.jobs.models import JobCategory

from ...models import (
    CvCategory,
    CvColor,
    CvLanguage,
    CvPositionField,
    CvPositionProfile,
    CvSampleContent,
    CvSampleGeneration,
    CvTemplate,
    CvTemplateVersion,
    ExperienceBand,
)

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

            before = getattr(self.instance, field)
            if before == after:
                continue
            required = (
                'cv_template.publish'
                if _is_published_state(field, after)
                else 'cv_template.archive'
            )
            require_admin_permission(request.user, required)
        return super().validate(attrs)


class CvTemplateVersionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CvTemplateVersion
        exclude = ['template', 'created_by']
        read_only_fields = [
            'version_number',
            'version_status',
            'published_at',
            'retired_at',
            'created_at',
        ]


class CvTemplateAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    versions = CvTemplateVersionAdminSerializer(many=True, read_only=True)
    current_published_version_id = serializers.IntegerField(read_only=True)

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
            'lifecycle_status',
            'current_published_version_id',
            'versions',
        ]
        read_only_fields = ['public_id', 'lifecycle_status', 'current_published_version_id']


class CvCategoryAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    class Meta:
        model = CvCategory
        fields = '__all__'
        read_only_fields = ['public_id', 'created_at', 'updated_at']


class CvColorAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
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

    def validate(self, attrs):
        instance = self.instance
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
    field_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CvPositionProfile
        fields = [
            'public_id',
            'position_public_id',
            'position_name',
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
