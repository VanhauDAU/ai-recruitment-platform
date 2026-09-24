from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from ..models import AiInvocation, AiUsageDaily
from ..tasks import purge_expired_ai_metadata


def create_invocation(*, correlation_key):
    return AiInvocation.objects.create(
        use_case='job_post_generation',
        correlation_key=correlation_key,
        provider='gemini',
        provider_backend='gemini_developer',
        model='gemini-test',
        prompt_version='v1',
        schema_version='v1',
        prompt_sha256='a' * 64,
        schema_sha256='b' * 64,
    )


def create_usage(*, date):
    return AiUsageDaily.objects.create(
        date=date,
        use_case='job_post_generation',
        provider='gemini',
        provider_backend='gemini_developer',
        model='gemini-test',
    )


class AiMetadataRetentionTests(TestCase):
    def test_task_has_stable_public_name_for_beat_routing(self):
        self.assertEqual(
            purge_expired_ai_metadata.name,
            'apps.ai_core.tasks.purge_expired_ai_metadata',
        )

    @override_settings(AI_INVOCATION_METADATA_RETENTION_DAYS=365)
    def test_deletes_only_expired_rows_across_multiple_batches(self):
        old_one = create_invocation(correlation_key='old-1')
        old_two = create_invocation(correlation_key='old-2')
        current = create_invocation(correlation_key='current')
        old_at = timezone.now() - timedelta(days=366)
        AiInvocation.objects.filter(pk__in=[old_one.pk, old_two.pk]).update(created_at=old_at)
        old_usage = create_usage(date=timezone.localdate() - timedelta(days=366))
        current_usage = create_usage(date=timezone.localdate())

        result = purge_expired_ai_metadata.run(batch_size=1)

        self.assertEqual(result['invocations_deleted'], 2)
        self.assertEqual(result['usage_rows_deleted'], 1)
        self.assertFalse(AiInvocation.objects.filter(pk__in=[old_one.pk, old_two.pk]).exists())
        self.assertTrue(AiInvocation.objects.filter(pk=current.pk).exists())
        self.assertFalse(AiUsageDaily.objects.filter(pk=old_usage.pk).exists())
        self.assertTrue(AiUsageDaily.objects.filter(pk=current_usage.pk).exists())

    @override_settings(AI_INVOCATION_METADATA_RETENTION_DAYS='invalid')
    def test_invalid_setting_falls_back_to_safe_default(self):
        old = create_invocation(correlation_key='old')
        AiInvocation.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=366)
        )

        result = purge_expired_ai_metadata.run()

        self.assertEqual(result['retention_days'], 365)
        self.assertFalse(AiInvocation.objects.filter(pk=old.pk).exists())
