from rest_framework import serializers

from common.storage.media import media_url_from_value

from ...models import Benefit, JobCategory, Language


class AdminJobCategorySerializer(serializers.ModelSerializer):
    name_en = serializers.SerializerMethodField()
    logo_preview = serializers.SerializerMethodField()
    job_count = serializers.IntegerField(read_only=True)
    child_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = JobCategory
        fields = [
            'id',
            'name',
            'name_en',
            'description',
            'category_type',
            'parent',
            'status',
            'logo_url',
            'logo_preview',
            'job_count',
            'child_count',
        ]

    def get_name_en(self, category) -> str:
        english = getattr(category, 'english', [])
        return english[0].display_name if english else ''

    def get_logo_preview(self, category) -> str | None:
        return media_url_from_value(category.logo_url, request=self.context.get('request'))


class JobCategoryWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    name_en = serializers.CharField(max_length=255, allow_blank=True, required=False)
    description = serializers.CharField(allow_blank=True, required=False)
    parent = serializers.PrimaryKeyRelatedField(
        queryset=JobCategory.objects.all(), allow_null=True, required=False
    )
    status = serializers.ChoiceField(choices=JobCategory.Status.choices, required=False)
    logo_url = serializers.CharField(allow_blank=True, required=False)


class CategoryIconUploadSerializer(serializers.Serializer):
    file = serializers.ImageField()


class CategoryIconSerializer(serializers.Serializer):
    path = serializers.CharField()
    url = serializers.CharField()


class AdminBenefitSerializer(serializers.ModelSerializer):
    job_count = serializers.IntegerField(read_only=True)
    company_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Benefit
        fields = ['id', 'name', 'category', 'is_active', 'sort_order', 'job_count', 'company_count']
        read_only_fields = ['sort_order']


class AdminLanguageSerializer(serializers.ModelSerializer):
    job_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Language
        fields = ['id', 'name', 'code', 'is_active', 'job_count']


class BenefitReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
