"""Admin contracts for per-position CV configuration and position-specific fields."""

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.jobs.models import JobCategory

from ...models import CvPositionField, CvPositionProfile


@extend_schema_field(OpenApiTypes.STR)
class PositionProfileField(serializers.SlugRelatedField):
    """Nhận và trả mã `JobCategory` thay cho khóa nội bộ của `CvPositionProfile`."""

    def to_representation(self, obj):
        return obj.job_category.public_id


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
