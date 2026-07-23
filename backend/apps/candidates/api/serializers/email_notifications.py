from rest_framework import serializers

from ...models import CandidateEmailNotificationSettings


class CandidateEmailNotificationSettingsSerializer(serializers.ModelSerializer):
    """Candidate-owned email notification opt-ins."""

    class Meta:
        model = CandidateEmailNotificationSettings
        fields = [
            'important_system_updates',
            'employer_viewed_cv',
            'new_features_and_cv_templates',
            'other_system_notifications',
            'configured_job_alerts',
            'suitable_job_recommendations',
            'top_candidate_alerts',
            'employer_invitations',
            'job_and_career_events',
            'service_introductions',
            'program_and_event_introductions',
            'partner_gifts_and_discounts',
        ]
