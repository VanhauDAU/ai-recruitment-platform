"""Read models for administrator employer-verification screens."""

from datetime import timedelta

from django.db.models import Count, IntegerField, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from ..models import Company, CompanyDocument, CompanyTaxLookupEvidence, EmployerVerificationCase


def admin_verification_cases_queryset(*, params=None):
    params = params or {}
    duplicate_tax_code_companies = (
        Company.objects.filter(tax_code=OuterRef('company__tax_code'))
        .exclude(tax_code__isnull=True)
        .exclude(pk=OuterRef('company_id'))
        .values('tax_code')
        .annotate(total=Count('id'))
        .values('total')[:1]
    )
    verified_duplicate_tax_code_companies = (
        Company.objects.filter(
            tax_code=OuterRef('company__tax_code'),
            verification_status=Company.VerificationStatus.VERIFIED,
        )
        .exclude(tax_code__isnull=True)
        .exclude(pk=OuterRef('company_id'))
        .values('tax_code')
        .annotate(total=Count('id'))
        .values('total')[:1]
    )
    duplicate_companies = (
        CompanyDocument.objects.filter(
            sha256=OuterRef('sha256'),
            company__isnull=False,
        )
        .exclude(sha256='')
        .exclude(company_id=OuterRef('company_id'))
        .values('sha256')
        .annotate(total=Count('company_id', distinct=True))
        .values('total')[:1]
    )
    documents = (
        CompanyDocument.objects.select_related(
            'uploaded_by',
            'reviewed_by',
        )
        .annotate(
            duplicate_company_count=Coalesce(
                Subquery(duplicate_companies, output_field=IntegerField()),
                Value(0),
            )
        )
        .order_by('doc_type', '-version', '-created_at')
    )
    queryset = (
        EmployerVerificationCase.objects.select_related(
            'recruiter__user',
            'recruiter__company',
            'recruiter__work_location',
            'company',
            'reviewer',
        )
        .prefetch_related(
            Prefetch('documents', queryset=documents),
            Prefetch(
                'documents',
                queryset=CompanyDocument.objects.filter(is_current=True),
                to_attr='current_documents_for_checks',
            ),
            'events__actor',
            Prefetch(
                'tax_lookup_evidences',
                queryset=CompanyTaxLookupEvidence.objects.order_by('-created_at', '-id'),
            ),
            Prefetch(
                'recruiter__recruitment_needs',
                to_attr='verification_recruitment_needs',
            ),
        )
        .annotate(
            duplicate_tax_code_company_count=Coalesce(
                Subquery(duplicate_tax_code_companies, output_field=IntegerField()),
                Value(0),
            ),
            verified_duplicate_tax_code_company_count=Coalesce(
                Subquery(
                    verified_duplicate_tax_code_companies,
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
            current_document_count=Count(
                'documents',
                filter=Q(documents__is_current=True),
                distinct=True,
            ),
            pending_document_count=Count(
                'documents',
                filter=Q(
                    documents__is_current=True,
                    documents__status=CompanyDocument.Status.PENDING,
                ),
                distinct=True,
            ),
        )
    )
    query = (params.get('q') or '').strip()
    if query:
        queryset = queryset.filter(
            Q(public_id__icontains=query)
            | Q(recruiter__user__email__icontains=query)
            | Q(recruiter__user__full_name__icontains=query)
            | Q(company__company_name__icontains=query)
            | Q(company__tax_code__icontains=query)
        )
    if params.get('status'):
        if params['status'] == EmployerVerificationCase.Status.PENDING:
            queryset = queryset.filter(
                Q(status=EmployerVerificationCase.Status.PENDING) | Q(pending_document_count__gt=0)
            )
        else:
            queryset = queryset.filter(status=params['status'])
    if params.get('company'):
        queryset = queryset.filter(company__public_id=params['company'])
    if params.get('document_type'):
        queryset = queryset.filter(
            documents__is_current=True,
            documents__doc_type=params['document_type'],
        )
    phone_verified = str(params.get('phone_verified', '')).lower()
    if phone_verified in {'true', 'false'}:
        queryset = queryset.filter(recruiter__phone_verified_at__isnull=phone_verified != 'true')
    age = params.get('age')
    now = timezone.now()
    if age == 'under_24h':
        queryset = queryset.filter(submitted_at__gte=now - timedelta(hours=24))
    elif age == '24_72h':
        queryset = queryset.filter(
            submitted_at__lt=now - timedelta(hours=24),
            submitted_at__gte=now - timedelta(hours=72),
        )
    elif age == 'over_72h':
        queryset = queryset.filter(submitted_at__lt=now - timedelta(hours=72))
    for key, lookup in (
        ('submitted_from', 'submitted_at__date__gte'),
        ('submitted_to', 'submitted_at__date__lte'),
    ):
        if params.get(key):
            queryset = queryset.filter(**{lookup: params[key]})
    ordering = params.get('ordering', '-submitted_at')
    allowed = {
        'recruiter__user__full_name',
        '-recruiter__user__full_name',
        'company__company_name',
        '-company__company_name',
        'status',
        '-status',
        'current_document_count',
        '-current_document_count',
        'recruiter__phone_verified_at',
        '-recruiter__phone_verified_at',
        'submitted_at',
        '-submitted_at',
    }
    return queryset.distinct().order_by(
        ordering if ordering in allowed else '-submitted_at',
        '-updated_at',
        '-id',
    )


def admin_verification_summary():
    now = timezone.now()
    pending_states = [
        EmployerVerificationCase.Status.PENDING,
        EmployerVerificationCase.Status.IN_REVIEW,
    ]
    base = EmployerVerificationCase.objects.all()
    pending_filter = Q(status__in=pending_states) | Q(
        documents__is_current=True,
        documents__status=CompanyDocument.Status.PENDING,
    )
    return {
        'pending': base.filter(pending_filter).distinct().count(),
        'overdue': base.filter(
            pending_filter,
            submitted_at__lt=now - timedelta(hours=72),
        )
        .distinct()
        .count(),
        'changes_requested': base.filter(
            status=EmployerVerificationCase.Status.CHANGES_REQUESTED
        ).count(),
        'approved': base.filter(status=EmployerVerificationCase.Status.APPROVED).count(),
        'rejected': base.filter(status=EmployerVerificationCase.Status.REJECTED).count(),
    }
