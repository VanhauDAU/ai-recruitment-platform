"""Role-aware contracts for lazily loaded admin account-detail sections."""

from rest_framework import serializers

from apps.applications.models import Application
from apps.campaigns.models import RecruitmentCampaign
from apps.candidates.models import CandidateConsent
from apps.cvs.models import UserCv
from apps.employers.models import RecruitmentNeed
from apps.jobs.models import Job


class AdminCvSerializer(serializers.ModelSerializer):
    source_label = serializers.CharField(source='get_source_display', read_only=True)
    processing_status_label = serializers.CharField(
        source='get_processing_status_display',
        read_only=True,
    )
    lifecycle_status_label = serializers.CharField(
        source='get_lifecycle_status_display',
        read_only=True,
    )
    visibility_label = serializers.CharField(source='get_visibility_display', read_only=True)
    template_name = serializers.CharField(source='template.name', allow_null=True, read_only=True)

    class Meta:
        model = UserCv
        fields = [
            'public_id',
            'title',
            'source',
            'source_label',
            'template_name',
            'processing_status',
            'processing_status_label',
            'lifecycle_status',
            'lifecycle_status_label',
            'visibility',
            'visibility_label',
            'is_default',
            'updated_at',
        ]


class AdminApplicationSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    source_label = serializers.CharField(source='get_source_display', read_only=True)
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    company_name = serializers.CharField(source='job.company.company_name', read_only=True)
    submitted_cv_version_public_id = serializers.CharField(
        source='submitted_cv_version.public_id',
        read_only=True,
    )

    class Meta:
        model = Application
        fields = [
            'public_id',
            'job_public_id',
            'job_title',
            'company_name',
            'submitted_cv_title',
            'submitted_cv_version_public_id',
            'status',
            'status_label',
            'source',
            'source_label',
            'applied_at',
            'viewed_at',
            'shortlisted_at',
            'interviewed_at',
            'rejected_at',
            'accepted_at',
        ]


class AdminCandidateConsentSerializer(serializers.ModelSerializer):
    consent_type_label = serializers.CharField(
        source='get_consent_type_display',
        read_only=True,
    )
    decision_label = serializers.CharField(source='get_decision_display', read_only=True)

    class Meta:
        model = CandidateConsent
        fields = [
            'consent_type',
            'consent_type_label',
            'decision',
            'decision_label',
            'policy_version',
            'decided_at',
            'updated_at',
        ]


class AdminRecruitmentNeedSerializer(serializers.ModelSerializer):
    position_category_name = serializers.CharField(
        source='position_category.name',
        read_only=True,
    )
    position_level_label = serializers.CharField(
        source='get_position_level_display',
        read_only=True,
    )
    budget_source_label = serializers.CharField(
        source='get_budget_source_display',
        read_only=True,
    )

    class Meta:
        model = RecruitmentNeed
        fields = [
            'public_id',
            'position_category_name',
            'position_level',
            'position_level_label',
            'target_date',
            'is_continuous',
            'headcount',
            'budget_min',
            'budget_max',
            'budget_source',
            'budget_source_label',
            'consultation_topics',
            'is_active',
            'completed_at',
            'updated_at',
        ]


class AdminJobSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    policy_hold_label = serializers.CharField(
        source='get_policy_hold_display',
        read_only=True,
    )
    campaign_name = serializers.CharField(source='campaign.name', allow_null=True, read_only=True)
    company_name = serializers.CharField(source='company.company_name', read_only=True)

    class Meta:
        model = Job
        fields = [
            'public_id',
            'title',
            'company_name',
            'campaign_name',
            'status',
            'status_label',
            'policy_hold',
            'policy_hold_label',
            'policy_held_at',
            'application_count',
            'view_count',
            'deadline',
            'submitted_at',
            'published_at',
            'created_at',
            'updated_at',
        ]


class AdminCampaignSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    policy_hold_label = serializers.CharField(
        source='get_policy_hold_display',
        read_only=True,
    )
    job_count = serializers.IntegerField(read_only=True)
    application_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = RecruitmentCampaign
        fields = [
            'public_id',
            'name',
            'description',
            'status',
            'status_label',
            'policy_hold',
            'policy_hold_label',
            'policy_held_at',
            'job_count',
            'application_count',
            'start_date',
            'target_date',
            'created_at',
            'updated_at',
        ]
