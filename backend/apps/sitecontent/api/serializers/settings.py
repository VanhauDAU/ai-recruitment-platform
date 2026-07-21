from decouple import config
from django.db import transaction
from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import Banner, Feedback, LinkGroup, Locale, SiteSetting
from ...selectors import resolve_link_group_items


class SiteSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ['key', 'label', 'group', 'value']


class LocaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Locale
        fields = [
            'code',
            'label_vi',
            'native_name',
            'flag_emoji',
            'catalog_path',
            'is_default',
            'is_active',
            'sort_order',
        ]
        read_only_fields = ['is_active']


class AdminLocaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Locale
        fields = [
            'code',
            'label_vi',
            'native_name',
            'flag_emoji',
            'catalog_path',
            'is_default',
            'is_active',
            'sort_order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {'is_default': {'validators': []}}
        validators = []

    def validate_code(self, value):
        if self.instance and self.instance.code != value:
            raise serializers.ValidationError('Locale code is immutable.')
        return value

    def validate(self, attrs):
        is_default = attrs.get('is_default', self.instance.is_default if self.instance else False)
        is_active = attrs.get('is_active', self.instance.is_active if self.instance else True)
        if is_default and not is_active:
            raise serializers.ValidationError({'is_active': 'Default locale must remain active.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        if validated_data.get('is_default'):
            Locale.objects.filter(is_default=True).update(is_default=False)
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        if validated_data.get('is_default'):
            Locale.objects.exclude(pk=instance.pk).filter(is_default=True).update(is_default=False)
        return super().update(instance, validated_data)


class AdminSiteSettingSerializer(serializers.ModelSerializer):
    """Bản đầy đủ cho trang quản trị: kèm metadata để tự render form.

    Với `value_type=env` chỉ trả về `env_configured` (có biến môi trường hay
    chưa), không bao giờ lộ giá trị secret.
    """

    env_configured = serializers.SerializerMethodField()
    display_value = serializers.SerializerMethodField()

    class Meta:
        model = SiteSetting
        fields = [
            'key',
            'label',
            'group',
            'value',
            'value_type',
            'options',
            'description',
            'is_public',
            'order',
            'env_configured',
            'display_value',
            'updated_at',
        ]

    def get_env_configured(self, obj):
        if obj.value_type != SiteSetting.ValueType.ENV:
            return None
        # python-decouple resolves backend/.env without mutating os.environ.
        # This must use the same resolver as runtime services so the admin badge
        # reflects whether a secret is actually available to the process.
        return bool(config(obj.options.get('env_var', ''), default=''))

    def get_display_value(self, obj):
        """URL chỉ để preview; ``value`` vẫn là storage key để PATCH an toàn."""
        if obj.value_type != SiteSetting.ValueType.IMAGE:
            return None
        return media_url_from_value(obj.value, request=self.context.get('request'))


class LinkGroupSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = LinkGroup
        fields = ['key', 'title', 'placement', 'source', 'items']

    def get_items(self, obj):
        return resolve_link_group_items(obj)


class BannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = [
            'id',
            'eyebrow',
            'title',
            'subtitle',
            'image_url',
            'theme',
            'cta_label',
            'cta_url',
        ]

    def get_image_url(self, obj):
        return media_url_from_value(obj.image_url, request=self.context.get('request'))


class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = [
            'id',
            'category',
            'content',
            'satisfaction',
            'phone',
            'email',
            'page_url',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'content': {'trim_whitespace': True, 'max_length': 2000},
        }

    def validate_content(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Mô tả góp ý cần ít nhất 10 ký tự.')
        return value.strip()
