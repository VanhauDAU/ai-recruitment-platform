from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ...models import Job, JobAiGeneration
from ...services import job_ai_quota_remaining


class JobAiBriefSerializer(serializers.Serializer):
    position = serializers.CharField(max_length=255)
    position_level = serializers.ChoiceField(
        choices=Job.PositionLevel.choices,
        required=False,
        allow_blank=True,
    )
    employment_type = serializers.ChoiceField(
        choices=Job.EmploymentType.choices,
        required=False,
        allow_blank=True,
    )
    work_types = serializers.ListField(
        child=serializers.ChoiceField(choices=Job.WorkType.choices),
        required=False,
        max_length=3,
        allow_empty=True,
    )
    responsibilities = serializers.ListField(
        child=serializers.CharField(max_length=120),
        required=False,
        max_length=10,
        allow_empty=True,
    )
    requirements = serializers.ListField(
        child=serializers.CharField(max_length=120),
        required=False,
        max_length=10,
        allow_empty=True,
    )
    preferred_skills = serializers.ListField(
        child=serializers.CharField(max_length=120),
        required=False,
        max_length=10,
        allow_empty=True,
    )
    notes = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    def validate_work_types(self, values):
        if len(values) != len(set(values)):
            raise serializers.ValidationError('Hình thức làm việc không được trùng nhau.')
        return values


class JobAiGenerationCreateSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=JobAiGeneration.Mode.choices)
    idempotency_key = serializers.RegexField(
        regex=r'^[A-Za-z0-9._:-]{1,64}$',
        max_length=64,
    )
    locale = serializers.ChoiceField(choices=['vi-VN'], default='vi-VN')
    brief = JobAiBriefSerializer(required=False)
    source_text = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=True,
        max_length=20000,
    )

    def validate(self, attrs):
        mode = attrs['mode']
        has_brief = 'brief' in attrs
        has_source = 'source_text' in attrs
        if mode == JobAiGeneration.Mode.AI_BRIEF and (not has_brief or has_source):
            raise serializers.ValidationError(
                {'brief': 'Chế độ brief yêu cầu brief và không nhận source_text.'}
            )
        if mode == JobAiGeneration.Mode.JD_TEXT and (not has_source or has_brief):
            raise serializers.ValidationError(
                {'source_text': 'Chế độ JD yêu cầu source_text và không nhận brief.'}
            )
        return attrs


class JobAiGenerationCreateResponseSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    status = serializers.ChoiceField(choices=JobAiGeneration.Status.choices)
    phase = serializers.ChoiceField(choices=JobAiGeneration.Phase.choices)
    quota_remaining = serializers.IntegerField(min_value=0)


class JobAiGenerationErrorSerializer(serializers.Serializer):
    code = serializers.CharField()
    detail = serializers.CharField()
    quota_remaining = serializers.IntegerField(min_value=0, required=False)


class JobAiGenerationSerializer(serializers.ModelSerializer):
    suggestion = serializers.JSONField(source='result', read_only=True)
    applied_job_public_id = serializers.CharField(
        source='applied_job.public_id',
        read_only=True,
        allow_null=True,
    )
    quota_remaining = serializers.SerializerMethodField()

    class Meta:
        model = JobAiGeneration
        fields = [
            'public_id',
            'mode',
            'status',
            'phase',
            'suggestion',
            'warnings',
            'unresolved_suggestions',
            'manual_fields',
            'error_code',
            'applied_job_public_id',
            'quota_remaining',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.IntegerField(min_value=0))
    def get_quota_remaining(self, obj):
        return job_ai_quota_remaining(user=obj.owner)


class JobAiGenerationFeedbackSerializer(serializers.Serializer):
    value = serializers.ChoiceField(choices=JobAiGeneration.Feedback.choices)
    reason = serializers.ChoiceField(
        choices=JobAiGeneration.FeedbackReason.choices,
        required=False,
        allow_blank=True,
        default='',
    )


class JobAiGenerationFeedbackResponseSerializer(serializers.Serializer):
    value = serializers.ChoiceField(choices=JobAiGeneration.Feedback.choices)
    reason = serializers.ChoiceField(
        choices=JobAiGeneration.FeedbackReason.choices,
        allow_blank=True,
    )
