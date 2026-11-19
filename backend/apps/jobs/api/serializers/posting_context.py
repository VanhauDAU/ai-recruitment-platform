"""What the employer job form learns before posting: limits, blockers and the commitment."""

from rest_framework import serializers

from apps.employers.models import DpaStatus


class JobResponsibilityAcknowledgementSerializer(serializers.Serializer):
    """Sent with every request that makes a job public (publish, reopen)."""

    responsibility_statement_version = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        max_length=20,
    )


class JobResponsibilityStatementSerializer(serializers.Serializer):
    version = serializers.CharField()
    text = serializers.CharField()


class EmployerPostingBlockerSerializer(serializers.Serializer):
    code = serializers.CharField()
    capabilities = serializers.ListField(
        child=serializers.ChoiceField(
            choices=('job_workspace', 'verification', 'candidate_data', 'job_approval')
        )
    )
    message = serializers.CharField()
    action = serializers.CharField()


class EmployerJobLifecyclePolicySerializer(serializers.Serializer):
    default_visibility_days = serializers.IntegerField(min_value=1)
    max_visibility_days = serializers.IntegerField(min_value=1)
    timezone = serializers.CharField()


class EmployerPublishBlockerSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()


class EmployerJobPostingContextSerializer(serializers.Serializer):
    default_deadline_days = serializers.IntegerField(min_value=1)
    max_deadline_days = serializers.IntegerField(min_value=1)
    max_public_lifetime_days = serializers.IntegerField(min_value=1)
    lifecycle_policy = EmployerJobLifecyclePolicySerializer()
    responsibility_statement = JobResponsibilityStatementSerializer()
    verification_completed = serializers.BooleanField()
    admin_approved = serializers.BooleanField()
    account_level = serializers.IntegerField(min_value=0)
    verified_job_quota_eligible = serializers.BooleanField()
    job_workspace_ready = serializers.BooleanField()
    candidate_data_access = serializers.BooleanField()
    dpa_status = serializers.ChoiceField(
        choices=[(status.value, status.value) for status in DpaStatus]
    )
    blockers = EmployerPostingBlockerSerializer(many=True)
    published_jobs_count = serializers.IntegerField(min_value=0)
    publish_blockers = EmployerPublishBlockerSerializer(many=True)
    publish_limit = serializers.IntegerField(min_value=0)
    publish_remain = serializers.IntegerField(min_value=0)
    verified_publish_limit = serializers.IntegerField(min_value=0)
    free_publish_limit = serializers.IntegerField(min_value=0)
    free_publish_remain = serializers.IntegerField(min_value=0)
    job_postable = serializers.BooleanField()
    block_reason = serializers.CharField(allow_blank=True)
