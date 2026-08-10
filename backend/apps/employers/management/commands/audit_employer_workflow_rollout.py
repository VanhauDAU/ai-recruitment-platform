"""Read-only rollout readiness report for the employer remediation epic."""

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.migrations.recorder import MigrationRecorder

from apps.employers.selectors.rollout import employer_rollout_counters
from apps.employers.services import DpaPolicyUnavailable, current_dpa_policy
from apps.employers.services.sms_provider import sms_configuration_errors
from apps.uploads.services import upload_scanner_readiness

EXPECTED_UPLOAD_PURPOSES = {
    'employer_verification',
    'employer_company_update',
    'candidate_cv',
}
EXPECTED_TASK_ROUTES = {
    'apps.employers.tasks.phone_sms.*': 'auth-sms',
    'apps.uploads.tasks.*': 'upload-scan',
}
EXPECTED_BEAT_TASKS = {
    'apps.uploads.tasks.dispatch_pending_upload_scans',
    'apps.uploads.tasks.expire_and_clean_upload_sessions',
    'apps.employers.tasks.phone_sms.recover_stale_employer_sms_dispatches',
    'apps.employers.tasks.phone_sms.purge_employer_sms_verification_data',
    'apps.employers.tasks.verification_notification.dispatch_pending_employer_verification_notifications',
    'apps.employers.tasks.notifications.purge_expired_employer_event_history',
}


def _route_queue(route):
    if isinstance(route, dict):
        return route.get('queue')
    return None


class Command(BaseCommand):
    help = 'Emit a PII-free, read-only employer rollout readiness report.'

    def add_arguments(self, parser):
        parser.add_argument('--strict', action='store_true')
        parser.add_argument('--probe-scanner', action='store_true')
        parser.add_argument('--json', action='store_true', dest='as_json')

    def handle(self, *args, **options):
        strict = options['strict']
        blockers = []
        warnings = []

        allowed_purposes = set(settings.UPLOAD_SESSION_ALLOWED_PURPOSES)
        missing_purposes = sorted(EXPECTED_UPLOAD_PURPOSES - allowed_purposes)
        if missing_purposes:
            blockers.append('upload_purpose_allowlist_incomplete')

        strict_flags = {
            'upload_quarantine_enabled': settings.UPLOAD_QUARANTINE_ENABLED,
            'employer_upload_session_required': settings.EMPLOYER_UPLOAD_SESSION_REQUIRED,
            'candidate_upload_session_required': settings.CANDIDATE_UPLOAD_SESSION_REQUIRED,
            'employer_sms_otp_enabled': settings.EMPLOYER_SMS_OTP_ENABLED,
        }
        if strict:
            blockers.extend(name for name, enabled in strict_flags.items() if not enabled)

        sms_errors = sms_configuration_errors(require_enabled=strict)
        if sms_errors:
            blockers.append('sms_configuration_invalid')

        try:
            current_dpa_policy()
            dpa_ready = True
        except DpaPolicyUnavailable:
            dpa_ready = False
            blockers.append('dpa_policy_unavailable')

        route_mismatches = sorted(
            pattern
            for pattern, expected_queue in EXPECTED_TASK_ROUTES.items()
            if _route_queue(settings.CELERY_TASK_ROUTES.get(pattern)) != expected_queue
        )
        if route_mismatches:
            blockers.append('celery_task_route_incomplete')

        configured_beat_tasks = {
            item.get('task') for item in settings.CELERY_BEAT_SCHEDULE.values()
        }
        missing_beat_tasks = sorted(EXPECTED_BEAT_TASKS - configured_beat_tasks)
        if missing_beat_tasks:
            blockers.append('celery_beat_schedule_incomplete')

        if settings.EMPLOYER_EVENT_RETENTION_DAYS < 730:
            blockers.append('employer_event_retention_too_short')

        scanner = {'probed': options['probe_scanner'], 'ready': False, 'code': 'not_probed'}
        if options['probe_scanner']:
            result = upload_scanner_readiness()
            scanner = {'probed': True, 'ready': result.ready, 'code': result.code}
            if not result.ready:
                blockers.append('upload_scanner_not_ready')
        elif strict:
            blockers.append('upload_scanner_probe_required')

        migration_applied = MigrationRecorder.Migration.objects.filter(
            app='employers',
            name='0043_employer_notification_preferences_and_outbox_dedupe',
        ).exists()
        if not migration_applied:
            blockers.append('employer_schema_not_expanded')

        counters = employer_rollout_counters()
        if counters['active_legacy_phone_challenges']:
            blockers.append('active_legacy_phone_challenges')
        for counter_name in (
            'legacy_dpa_acceptances',
            'legacy_verification_cases',
            'legacy_verified_companies',
            'legacy_upload_assets',
        ):
            if counters[counter_name]:
                warnings.append(counter_name)

        report = {
            'ready': not blockers,
            'strict': strict,
            'configuration': {
                **strict_flags,
                'dpa_policy_ready': dpa_ready,
                'event_retention_days': settings.EMPLOYER_EVENT_RETENTION_DAYS,
                'missing_upload_purposes': missing_purposes,
                'route_mismatches': route_mismatches,
                'missing_beat_tasks': missing_beat_tasks,
                'sms_error_count': len(sms_errors),
                'schema_expanded': migration_applied,
                'scanner': scanner,
            },
            'counters': counters,
            'blockers': sorted(set(blockers)),
            'warnings': sorted(set(warnings)),
        }
        rendered = json.dumps(report, sort_keys=True)
        self.stdout.write(rendered)
        if strict and blockers:
            raise CommandError('Employer rollout readiness failed.')
