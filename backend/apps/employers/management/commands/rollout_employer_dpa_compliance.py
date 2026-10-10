"""Dry-run-first rollout for employer DPA grace and expired holds."""

import json
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.employers.models import RecruiterProfile
from apps.employers.services import (
    DpaPolicyUnavailable,
    apply_expired_dpa_holds_batch,
    current_dpa_policy,
)


class Command(BaseCommand):
    help = 'Roll out DPA grace or apply expired DPA holds; dry-run by default.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--phase',
            required=True,
            choices=('start-grace', 'expired-holds'),
        )
        parser.add_argument('--rollout-id', required=True)
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--batch-size', type=int, default=100)
        parser.add_argument('--cursor', type=int, default=0)

    def handle(self, *args, **options):
        rollout_id = options['rollout_id'].strip()
        batch_size = options['batch_size']
        if not rollout_id or len(rollout_id) > 64:
            raise CommandError('rollout-id phải có 1–64 ký tự.')
        if batch_size < 1 or batch_size > 1000:
            raise CommandError('batch-size phải trong khoảng 1–1000.')
        try:
            policy = current_dpa_policy()
        except DpaPolicyUnavailable as error:
            raise CommandError(str(error)) from error
        now = timezone.now()
        queryset = RecruiterProfile.objects.filter(pk__gt=options['cursor']).order_by('pk')
        if options['phase'] == 'start-grace':
            queryset = queryset.filter(
                dpa_accepted_at__isnull=False,
                dpa_grace_expires_at__isnull=True,
            ).exclude(
                dpa_policy_version=policy['policy_version'],
                dpa_document_sha256=policy['document_sha256'],
            )
        else:
            queryset = queryset.filter(
                dpa_grace_rollout_id=rollout_id,
                dpa_grace_expires_at__lte=now,
            ).exclude(
                dpa_policy_version=policy['policy_version'],
                dpa_document_sha256=policy['document_sha256'],
            )
        recruiter_ids = list(queryset.values_list('pk', flat=True)[:batch_size])
        result = {
            'phase': options['phase'],
            'rollout_id': rollout_id,
            'apply': options['apply'],
            'selected': len(recruiter_ids),
            'first_id': recruiter_ids[0] if recruiter_ids else None,
            'next_cursor': recruiter_ids[-1] if recruiter_ids else options['cursor'],
        }
        if not options['apply'] or not recruiter_ids:
            self.stdout.write(json.dumps(result, sort_keys=True))
            return
        if options['phase'] == 'start-grace':
            expires_at = now + timedelta(days=settings.EMPLOYER_DPA_GRACE_DAYS)
            with transaction.atomic():
                updated = (
                    RecruiterProfile.objects.filter(
                        pk__in=recruiter_ids,
                        dpa_accepted_at__isnull=False,
                        dpa_grace_expires_at__isnull=True,
                    )
                    .exclude(
                        dpa_policy_version=policy['policy_version'],
                        dpa_document_sha256=policy['document_sha256'],
                    )
                    .update(
                        dpa_grace_started_at=now,
                        dpa_grace_expires_at=expires_at,
                        dpa_grace_rollout_id=rollout_id,
                        updated_at=now,
                    )
                )
            result['updated'] = updated
        else:
            holds, created = apply_expired_dpa_holds_batch(
                recruiter_ids,
                rollout_id=rollout_id,
            )
            result['active_holds'] = len(holds)
            result['created_holds'] = created
        self.stdout.write(json.dumps(result, sort_keys=True))
