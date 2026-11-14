from rest_framework import serializers

from apps.sitecontent.selectors import get_bool_setting

from ...models import CandidateEmailNotificationSettings


class CandidateEmailNotificationSettingsSerializer(serializers.ModelSerializer):
    """Candidate-owned notification channels (email + website)."""

    email_delivery_enabled = serializers.SerializerMethodField()

    class Meta:
        model = CandidateEmailNotificationSettings
        fields = [
            'application_received_email',
            'application_received_web',
            'similar_jobs_in_application_email',
            'cv_activity_email',
            'cv_activity_web',
            'configured_job_alerts',
            'suitable_job_recommendations',
            'followed_company_jobs',
            'email_delivery_enabled',
        ]
        read_only_fields = ['email_delivery_enabled']

    def get_email_delivery_enabled(self, obj) -> bool:
        # Admin kill switch for all product email; the page explains it.
        return get_bool_setting('email_notifications_enabled', True)
