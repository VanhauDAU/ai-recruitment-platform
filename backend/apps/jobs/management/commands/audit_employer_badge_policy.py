from django.core.management.base import BaseCommand

from apps.jobs.models import Job
from apps.jobs.selectors.verification_badge import badge_state_map


class Command(BaseCommand):
    help = 'Dry-run aggregate recruiter badge cohorts without emitting PII.'

    def handle(self, *args, **options):
        keys = set(
            Job.objects.exclude(company_id=None)
            .exclude(posted_by_id=None)
            .values_list('company_id', 'posted_by_id')
            .distinct()
        )
        states = badge_state_map(keys)
        cohorts = {
            'legacy_and_policy': 0,
            'legacy_only': 0,
            'policy_only': 0,
            'neither': 0,
        }
        failures = {key: 0 for key in (
            'email_domain_verified',
            'phone_verified',
            'business_doc_approved',
            'account_age_reached',
            'no_report_history',
        )}
        for state in states.values():
            if state['legacy_verified'] and state['policy_verified']:
                cohorts['legacy_and_policy'] += 1
            elif state['legacy_verified']:
                cohorts['legacy_only'] += 1
            elif state['policy_verified']:
                cohorts['policy_only'] += 1
            else:
                cohorts['neither'] += 1
            for key in failures:
                failures[key] += int(not state[key])

        self.stdout.write(f'total_recruiters={len(states)}')
        for key, value in cohorts.items():
            self.stdout.write(f'{key}={value}')
        for key, value in failures.items():
            self.stdout.write(f'failed_{key}={value}')
