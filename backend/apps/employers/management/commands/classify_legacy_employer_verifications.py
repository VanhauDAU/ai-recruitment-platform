import json
from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Prefetch

from apps.employers.models import (
    Company,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)

AUTO_APPROVAL_SOURCES = {
    'document_review',
    'reconciliation',
    'phone_verified',
    'dpa_accepted',
    'registration_completed',
    'recruitment_need_completed',
}


def classify_case(case):
    approval_events = [
        event
        for event in case.events.all()
        if event.event_type == EmployerVerificationEvent.EventType.APPROVED
    ]
    if any(
        (event.payload or {}).get('source') in AUTO_APPROVAL_SOURCES for event in approval_events
    ):
        return EmployerVerificationCase.DecisionSource.LEGACY_AUTO
    if any(event.actor_id is not None for event in approval_events):
        return EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN
    return EmployerVerificationCase.DecisionSource.LEGACY_UNKNOWN


def classify_company(company):
    sources = {
        case.decision_source or classify_case(case)
        for case in company.recruiter_verification_cases.all()
        if case.status == EmployerVerificationCase.Status.APPROVED
    }
    if EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN in sources:
        return Company.VerificationSource.EXPLICIT_ADMIN
    if EmployerVerificationCase.DecisionSource.LEGACY_AUTO in sources:
        return Company.VerificationSource.LEGACY_AUTO
    return Company.VerificationSource.LEGACY_UNKNOWN


class Command(BaseCommand):
    help = (
        'Dry-run/report and optionally classify legacy approved employer cases/companies. '
        'The command never creates actor/evidence or compliance holds.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--batch-size', type=int, default=500)
        parser.add_argument('--case-cursor', type=int, default=0)
        parser.add_argument('--company-cursor', type=int, default=0)

    def _classify(self, *, options, lock):
        batch_size = options['batch_size']
        events = EmployerVerificationEvent.objects.only(
            'id',
            'verification_case_id',
            'event_type',
            'actor_id',
            'payload',
        ).order_by('id')
        case_queryset = EmployerVerificationCase.objects.filter(
            pk__gt=options['case_cursor'],
            status=EmployerVerificationCase.Status.APPROVED,
            decision_source='',
        )
        if lock:
            case_queryset = case_queryset.select_for_update(of=('self',))
        cases = list(
            case_queryset.prefetch_related(Prefetch('events', queryset=events)).order_by('pk')[
                :batch_size
            ]
        )
        case_counts = Counter()
        for case in cases:
            source = classify_case(case)
            if not lock or EmployerVerificationCase.objects.filter(
                pk=case.pk,
                decision_source='',
            ).update(decision_source=source):
                case.decision_source = source
                case_counts[source] += 1

        company_queryset = Company.objects.filter(
            pk__gt=options['company_cursor'],
            verification_status=Company.VerificationStatus.VERIFIED,
            verification_source='',
        )
        if lock:
            company_queryset = company_queryset.select_for_update(of=('self',))
        companies = list(
            company_queryset.prefetch_related(
                Prefetch(
                    'recruiter_verification_cases',
                    queryset=EmployerVerificationCase.objects.prefetch_related(
                        Prefetch('events', queryset=events)
                    ),
                )
            ).order_by('pk')[:batch_size]
        )
        company_counts = Counter()
        for company in companies:
            source = classify_company(company)
            if not lock or Company.objects.filter(
                pk=company.pk,
                verification_source='',
            ).update(verification_source=source):
                company.verification_source = source
                company_counts[source] += 1
        return cases, companies, case_counts, company_counts

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        if batch_size < 1 or batch_size > 5000:
            raise CommandError('--batch-size phải trong khoảng 1..5000.')
        if options['apply']:
            with transaction.atomic():
                cases, companies, case_counts, company_counts = self._classify(
                    options=options,
                    lock=True,
                )
        else:
            cases, companies, case_counts, company_counts = self._classify(
                options=options,
                lock=False,
            )

        report = {
            'mode': 'apply' if options['apply'] else 'dry_run',
            'cases': dict(sorted(case_counts.items())),
            'companies': dict(sorted(company_counts.items())),
            'next_case_cursor': cases[-1].pk if cases else options['case_cursor'],
            'next_company_cursor': (companies[-1].pk if companies else options['company_cursor']),
            'holds_created': 0,
            'evidence_created': 0,
        }
        self.stdout.write(json.dumps(report, ensure_ascii=False, sort_keys=True))
