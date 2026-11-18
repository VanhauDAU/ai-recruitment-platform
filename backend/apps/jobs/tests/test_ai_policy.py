from django.test import SimpleTestCase, override_settings

from ..domain import resolve_job_ai_policy

ENV = {
    'AI_RUNTIME_ENABLED': True,
    'AI_JOB_GENERATION_MODEL': 'model-a',
    'AI_JOB_GENERATION_MODEL_ALLOWLIST': ('model-a', 'model-b'),
    'AI_JOB_GENERATION_DAILY_LIMIT': 10,
}


@override_settings(**ENV)
class JobAiPolicyTests(SimpleTestCase):
    def test_site_settings_only_narrow_environment_ceilings(self):
        policy = resolve_job_ai_policy(
            {
                'ai_job_generation_enabled': 'true',
                'ai_job_generation_model': 'model-b',
                'ai_job_generation_daily_limit': 50,
                'ai_job_generation_rollout_percent': 250,
            }
        )

        self.assertTrue(policy.enabled)
        self.assertEqual(policy.model, 'model-b')
        self.assertEqual(policy.allowed_models, ('model-a', 'model-b'))
        self.assertEqual(policy.daily_limit, 10)
        self.assertEqual(policy.rollout_percent, 100)

    def test_model_outside_allowlist_disables_instead_of_falling_back(self):
        policy = resolve_job_ai_policy(
            {
                'ai_job_generation_enabled': True,
                'ai_job_generation_model': 'model-b',
                'ai_job_generation_model_allowlist': 'model-a',
            }
        )

        self.assertEqual(policy.model, '')
        self.assertEqual(policy.requested_model, 'model-b')
        self.assertFalse(policy.enabled)

    @override_settings(AI_RUNTIME_ENABLED='true')
    def test_hard_switch_fails_closed_on_non_boolean_values(self):
        policy = resolve_job_ai_policy({'ai_job_generation_enabled': True})

        self.assertFalse(policy.hard_switch_enabled)
        self.assertFalse(policy.enabled)

    def test_company_allowlist_bypasses_rollout_bucket(self):
        policy = resolve_job_ai_policy(
            {
                'ai_job_generation_rollout_percent': 0,
                'ai_job_generation_company_allowlist': ['cmp-pilot'],
            }
        )

        self.assertTrue(policy.allows_company('cmp-pilot'))
        self.assertFalse(policy.allows_company('cmp-other'))
