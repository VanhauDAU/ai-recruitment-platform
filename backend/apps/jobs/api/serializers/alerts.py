from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.locations.models import Location

from ...models import Job, JobAlert, JobCategory


class JobAlertWriteSerializer(serializers.ModelSerializer):
    category_ids = serializers.PrimaryKeyRelatedField(
        source='categories',
        queryset=JobCategory.objects.filter(status=JobCategory.Status.ACTIVE),
        many=True,
        required=False,
    )
    province_id = serializers.PrimaryKeyRelatedField(
        source='province',
        queryset=Location.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    ward_id = serializers.PrimaryKeyRelatedField(
        source='ward',
        queryset=Location.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = JobAlert
        fields = [
            'keyword',
            'keyword_scope',
            'category_ids',
            'province_id',
            'ward_id',
            'salary_bucket',
            'experience_years',
            'work_type',
            'employment_type',
            'frequency',
            'is_active',
        ]
        extra_kwargs = {
            'keyword': {'required': True, 'allow_blank': False, 'trim_whitespace': True},
            'keyword_scope': {'required': False},
            'salary_bucket': {'required': False, 'allow_blank': True, 'allow_null': True},
            'experience_years': {'required': False, 'allow_blank': True, 'allow_null': True},
            'work_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'employment_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'frequency': {'required': False},
            'is_active': {'required': False},
        }

    def validate_keyword(self, value):
        value = ' '.join(value.split())
        if not value:
            raise serializers.ValidationError('Vui lòng nhập từ khóa việc làm.')
        return value

    def validate_category_ids(self, value):
        category_ids = [category.pk for category in value]
        if len(category_ids) != len(set(category_ids)):
            raise serializers.ValidationError('Không được chọn trùng ngành nghề.')
        return value

    def validate(self, attrs):
        if self.instance is None and 'is_active' in self.initial_data:
            raise serializers.ValidationError(
                {'is_active': 'Trạng thái chỉ được thay đổi sau khi tạo thông báo.'}
            )
        province = attrs.get('province', getattr(self.instance, 'province', None))
        ward = attrs.get('ward', getattr(self.instance, 'ward', None))
        if province and province.level != Location.Level.PROVINCE:
            raise serializers.ValidationError(
                {'province_id': 'Địa điểm này không phải tỉnh/thành.'}
            )
        if ward and ward.level != Location.Level.WARD:
            raise serializers.ValidationError({'ward_id': 'Địa điểm này không phải phường/xã.'})
        if ward and not province:
            raise serializers.ValidationError(
                {'province_id': 'Cần chọn tỉnh/thành trước khi chọn phường/xã.'}
            )
        if ward and province and ward.parent_id != province.pk:
            raise serializers.ValidationError(
                {'ward_id': 'Phường/xã không thuộc tỉnh/thành đã chọn.'}
            )
        return attrs


class JobAlertCreateSerializer(JobAlertWriteSerializer):
    """POST contract: newly created alerts are active and cannot choose state."""

    class Meta(JobAlertWriteSerializer.Meta):
        fields = [field for field in JobAlertWriteSerializer.Meta.fields if field != 'is_active']


class JobAlertCategoryReadSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    category_type = serializers.ChoiceField(choices=JobCategory.CategoryType.choices)


class JobAlertLocationReadSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    level = serializers.ChoiceField(choices=Location.Level.choices)


class JobAlertReadSerializer(serializers.ModelSerializer):
    category_ids = serializers.SerializerMethodField()
    province_id = serializers.IntegerField(read_only=True, allow_null=True)
    ward_id = serializers.IntegerField(read_only=True, allow_null=True)
    categories = serializers.SerializerMethodField()
    province = serializers.SerializerMethodField()
    ward = serializers.SerializerMethodField()
    salary_bucket = serializers.ChoiceField(
        choices=JobAlert.SalaryBucket.choices,
        allow_null=True,
        read_only=True,
    )
    experience_years = serializers.ChoiceField(
        choices=Job.ExperienceYears.choices,
        allow_null=True,
        read_only=True,
    )
    work_type = serializers.ChoiceField(
        choices=Job.WorkType.choices,
        allow_null=True,
        read_only=True,
    )
    employment_type = serializers.ChoiceField(
        choices=Job.EmploymentType.choices,
        allow_null=True,
        read_only=True,
    )
    keyword_scope_label = serializers.CharField(
        source='get_keyword_scope_display',
        read_only=True,
    )
    salary_bucket_label = serializers.CharField(
        source='get_salary_bucket_display',
        allow_null=True,
        read_only=True,
    )
    experience_years_label = serializers.CharField(
        source='get_experience_years_display',
        allow_null=True,
        read_only=True,
    )
    work_type_label = serializers.CharField(
        source='get_work_type_display',
        allow_null=True,
        read_only=True,
    )
    employment_type_label = serializers.CharField(
        source='get_employment_type_display',
        allow_null=True,
        read_only=True,
    )
    frequency_label = serializers.CharField(source='get_frequency_display', read_only=True)
    next_delivery_at = serializers.DateTimeField(source='next_run_at', read_only=True)

    class Meta:
        model = JobAlert
        fields = [
            'public_id',
            'keyword',
            'keyword_scope',
            'keyword_scope_label',
            'category_ids',
            'categories',
            'province_id',
            'province',
            'ward_id',
            'ward',
            'salary_bucket',
            'salary_bucket_label',
            'experience_years',
            'experience_years_label',
            'work_type',
            'work_type_label',
            'employment_type',
            'employment_type_label',
            'frequency',
            'frequency_label',
            'is_active',
            'next_delivery_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.IntegerField()))
    def get_category_ids(self, obj) -> list[int]:
        return [category.pk for category in obj.categories.all()]

    @extend_schema_field(JobAlertCategoryReadSerializer(many=True))
    def get_categories(self, obj) -> list[dict]:
        return [
            {
                'id': category.pk,
                'name': category.name,
                'category_type': category.category_type,
            }
            for category in obj.categories.all()
        ]

    @staticmethod
    def _location(value):
        if value is None:
            return None
        return {'id': value.pk, 'name': value.name, 'level': value.level}

    @extend_schema_field(JobAlertLocationReadSerializer(allow_null=True))
    def get_province(self, obj) -> dict | None:
        return self._location(obj.province)

    @extend_schema_field(JobAlertLocationReadSerializer(allow_null=True))
    def get_ward(self, obj) -> dict | None:
        return self._location(obj.ward)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for field in ('salary_bucket', 'experience_years', 'work_type', 'employment_type'):
            if data[field] == '':
                data[field] = None
                data[f'{field}_label'] = None
        return data


class JobAlertListResponseSerializer(serializers.Serializer):
    results = JobAlertReadSerializer(many=True)
    limit = serializers.IntegerField()
    remaining = serializers.IntegerField()
