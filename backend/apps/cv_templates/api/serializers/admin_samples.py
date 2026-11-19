"""Admin contracts for starter (sample) contents and their AI generation runs."""

from rest_framework import serializers

from ...models import (
    CvLanguage,
    CvPositionProfile,
    CvSampleContent,
    CvSampleGeneration,
    ExperienceBand,
)
from .admin_positions import PositionProfileField


class CvSampleContentAdminSerializer(serializers.ModelSerializer):
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
