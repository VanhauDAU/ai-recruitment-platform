from django.utils.translation import gettext
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ...domain import UNCOUNTED_GROUPS
from ...models import USAGE_RELATIONS, Skill, SkillGroup


class SkillUsageSerializer(serializers.Serializer):
    jobs = serializers.IntegerField()
    cvs = serializers.IntegerField()
    candidates = serializers.IntegerField()


class AdminSkillSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True, default='')
    usage = serializers.SerializerMethodField()
    usage_total = serializers.IntegerField(read_only=True)

    class Meta:
        model = Skill
        fields = [
            'id',
            'name',
            'aliases',
            'group',
            'group_name',
            'description',
            'is_active',
            'source',
            'created_at',
            'usage',
            'usage_total',
        ]

    @extend_schema_field(SkillUsageSerializer)
    def get_usage(self, skill):
        return {key: getattr(skill, f'usage_{key}') for key in USAGE_RELATIONS}


class SkillWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, min_length=1)
    aliases = serializers.ListField(
        child=serializers.CharField(max_length=255), max_length=50, required=False
    )
    group = serializers.PrimaryKeyRelatedField(
        queryset=SkillGroup.objects.all(), allow_null=True, required=False
    )
    description = serializers.CharField(allow_blank=True, required=False)
    is_active = serializers.BooleanField(required=False)


class SkillBulkUpdateSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, max_length=200)
    group = serializers.PrimaryKeyRelatedField(
        queryset=SkillGroup.objects.all(), allow_null=True, required=False
    )
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if 'group' not in attrs and 'is_active' not in attrs:
            raise serializers.ValidationError(gettext('Cần chọn nhóm hoặc trạng thái để cập nhật.'))
        return attrs


class SkillMergeSerializer(serializers.Serializer):
    target = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.all())


class SkillMergePreviewSerializer(serializers.Serializer):
    moved = SkillUsageSerializer()
    dropped = SkillUsageSerializer()


class SkillSummarySerializer(serializers.Serializer):
    ungrouped = serializers.IntegerField()
    duplicates = serializers.IntegerField()


class AdminSkillGroupSerializer(serializers.ModelSerializer):
    skill_count = serializers.IntegerField(read_only=True)
    is_system = serializers.SerializerMethodField()

    class Meta:
        model = SkillGroup
        fields = ['id', 'name', 'parent', 'is_active', 'skill_count', 'is_system']

    def get_is_system(self, group) -> bool:
        return group.name in UNCOUNTED_GROUPS


class SkillGroupWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    parent = serializers.PrimaryKeyRelatedField(
        queryset=SkillGroup.objects.all(), allow_null=True, required=False
    )
    is_active = serializers.BooleanField(required=False)
