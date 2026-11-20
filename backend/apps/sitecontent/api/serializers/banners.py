from rest_framework import serializers

from apps.employers.api.serializers import PublicCompanyListSerializer
from apps.employers.models import Company
from common.storage.media import media_url_from_value

from ...models import Banner


class BannerCompanySerializer(PublicCompanyListSerializer):
    """Phần công ty công khai mà slide nhà tuyển dụng cần."""

    class Meta(PublicCompanyListSerializer.Meta):
        fields = [
            'public_id',
            'slug',
            'company_name',
            'trade_name',
            'logo_url',
            'cover_image_url',
            'description_excerpt',
            'headquarters',
            'active_public_job_count',
            'industries_detail',
        ]
        read_only_fields = fields


class BannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    company = BannerCompanySerializer(read_only=True, allow_null=True)

    class Meta:
        model = Banner
        fields = [
            'id',
            'kind',
            'eyebrow',
            'title',
            'subtitle',
            'image_url',
            'theme',
            'cta_label',
            'cta_url',
            'cta_secondary_label',
            'cta_secondary_url',
            'company',
        ]

    def get_image_url(self, obj) -> str:
        return media_url_from_value(obj.image_url, request=self.context.get('request'))


class AdminBannerSerializer(BannerSerializer):
    """Bản quản trị: thêm đường dẫn ảnh gốc, lịch chạy và trạng thái tính sẵn."""

    image_path = serializers.CharField(source='image_url', read_only=True)
    schedule_state = serializers.SerializerMethodField()

    class Meta(BannerSerializer.Meta):
        fields = [
            *BannerSerializer.Meta.fields,
            'placement',
            'image_path',
            'order',
            'is_active',
            'starts_at',
            'ends_at',
            'schedule_state',
            'created_at',
            'updated_at',
        ]

    def get_schedule_state(self, obj) -> str:
        return obj.schedule_state()


class BannerWriteSerializer(serializers.Serializer):
    """Dữ liệu ghi; ràng buộc theo loại slide nằm ở ``Banner.clean``."""

    placement = serializers.ChoiceField(choices=Banner.Placement.choices)
    kind = serializers.ChoiceField(choices=Banner.Kind.choices)
    company = serializers.SlugRelatedField(
        slug_field='public_id',
        queryset=Company.objects.all(),
        required=False,
        allow_null=True,
    )
    eyebrow = serializers.CharField(max_length=100, required=False, allow_blank=True)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    subtitle = serializers.CharField(max_length=300, required=False, allow_blank=True)
    image_url = serializers.CharField(required=False, allow_blank=True)
    theme = serializers.ChoiceField(choices=Banner.Theme.choices, required=False)
    cta_label = serializers.CharField(max_length=100, required=False, allow_blank=True)
    cta_url = serializers.CharField(max_length=300, required=False, allow_blank=True)
    cta_secondary_label = serializers.CharField(max_length=100, required=False, allow_blank=True)
    cta_secondary_url = serializers.CharField(max_length=300, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    ends_at = serializers.DateTimeField(required=False, allow_null=True)


class BannerReorderSerializer(serializers.Serializer):
    placement = serializers.ChoiceField(choices=Banner.Placement.choices)
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)


class BannerImageUploadSerializer(serializers.Serializer):
    file = serializers.ImageField()
    placement = serializers.ChoiceField(choices=Banner.Placement.choices)
    kind = serializers.ChoiceField(choices=Banner.Kind.choices)
