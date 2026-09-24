"""Read-only company queries."""

from django.db.models import (
    Count,
    Exists,
    F,
    Max,
    OuterRef,
    Q,
    Subquery,
)
from django.db.models.functions import Coalesce, Length, Trim

from apps.accounts.models import User
from apps.jobs.models import Job
from common.db.search import fold_accents, search_q

from ..models import (
    Company,
    CompanyDocument,
    CompanyIndustry,
    EmployerVerificationCase,
    RecruiterProfile,
)

PUBLIC_COMPANY_FIELDS = (
    'id',
    'public_id',
    'slug',
    'company_name',
    'trade_name',
    'logo_url',
    'cover_image_url',
    'description',
    'company_size',
    'business_type',
    'address',
)


def _catalog_companies_queryset():
    """Exclude sparse records created by the retired registration shortcut."""
    has_industry = CompanyIndustry.objects.filter(company_id=OuterRef('pk'))
    return Company.objects.alias(_has_catalog_industry=Exists(has_industry)).exclude(
        tax_code__isnull=True,
        has_no_logo=True,
        has_no_website=True,
        _has_catalog_industry=False,
    )


def _eligible_representatives_queryset():
    """Recruiters whose current legal evidence authorizes this company link."""
    current_approved_documents = CompanyDocument.objects.filter(
        verification_case_id=OuterRef('verification_case'),
        company_id=OuterRef('company_id'),
        is_current=True,
        status=CompanyDocument.Status.APPROVED,
    )
    return (
        RecruiterProfile.objects.filter(
            company_id__isnull=False,
            user__role=User.Role.EMPLOYER,
            user__status=User.Status.ACTIVE,
            user__is_active=True,
            user__is_deleted=False,
            verification_case__status=EmployerVerificationCase.Status.APPROVED,
            verification_case__company_id=F('company_id'),
        )
        .alias(
            _has_business_registration=Exists(
                current_approved_documents.filter(
                    doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
                )
            ),
            _has_authorization=Exists(
                current_approved_documents.filter(
                    doc_type=CompanyDocument.DocType.AUTHORIZATION_LETTER,
                )
            ),
            _has_identity_document=Exists(
                current_approved_documents.filter(
                    doc_type=CompanyDocument.DocType.IDENTITY_DOCUMENT,
                )
            ),
        )
        .filter(
            Q(
                verification_case__verification_method=(
                    EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
                ),
                _has_business_registration=True,
            )
            | Q(
                verification_case__verification_method=(
                    EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID
                ),
                _has_authorization=True,
                _has_identity_document=True,
            )
        )
    )


def _legally_represented_companies_queryset():
    eligible_representatives = _eligible_representatives_queryset().filter(
        company_id=OuterRef('pk')
    )
    return Company.objects.alias(
        _has_eligible_representative=Exists(eligible_representatives),
    ).filter(_has_eligible_representative=True)


def _public_company_projection(queryset):
    return queryset.only(*PUBLIC_COMPANY_FIELDS).prefetch_related('industries')


def _featured_company_candidates_queryset():
    has_industry = CompanyIndustry.objects.filter(company_id=OuterRef('pk'))
    return (
        _legally_represented_companies_queryset()
        .alias(
            _logo_length=Length(Trim('logo_url')),
            _cover_length=Length(Trim('cover_image_url')),
            _has_industry=Exists(has_industry),
        )
        .filter(
            _logo_length__gt=0,
            _cover_length__gt=0,
            _has_industry=True,
        )
    )


def _featured_public_job_metrics_queryset():
    """Aggregate canonical jobs once for every profile-eligible company.

    Keeping the legal/media candidate set as one semi-join lets PostgreSQL run
    the expensive canonical job predicate once.  A pair of scalar subqueries
    would be expanded again by ``WHERE``/``ORDER BY`` and repeat the same join
    graph for every company before the limit.
    """
    candidate_ids = _featured_company_candidates_queryset().order_by().values('pk')
    return (
        Job.publicly_available_queryset()
        .filter(company_id__in=Subquery(candidate_ids))
        .order_by()
        .values('company_id')
        .annotate(
            active_public_job_count=Count('id', distinct=True),
            latest_public_job_at=Max(Coalesce('published_at', 'created_at')),
        )
        .order_by(
            '-active_public_job_count',
            '-latest_public_job_at',
            'company__company_name',
            'company_id',
        )
    )


def featured_public_companies(*, limit=18):
    """Return the ranked, finite featured pool with one canonical aggregation."""
    if limit < 1:
        return []
    metrics = list(_featured_public_job_metrics_queryset()[:limit])
    if not metrics:
        return []

    company_ids = [item['company_id'] for item in metrics]
    companies_by_id = {
        company.pk: company
        for company in _public_company_projection(
            Company.objects.filter(pk__in=company_ids),
        )
    }
    ranked_companies = []
    for item in metrics:
        company = companies_by_id.get(item['company_id'])
        if company is None:
            continue
        company.active_public_job_count = item['active_public_job_count']
        company.latest_public_job_at = item['latest_public_job_at']
        ranked_companies.append(company)
    return ranked_companies


def attach_active_public_job_counts(companies):
    """Attach one grouped canonical count query to an already bounded page."""
    companies = list(companies)
    company_ids = [company.pk for company in companies]
    counts = {}
    if company_ids:
        counts = {
            item['company_id']: item['active_public_job_count']
            for item in (
                Job.publicly_available_queryset()
                .filter(company_id__in=company_ids)
                .order_by()
                .values('company_id')
                .annotate(active_public_job_count=Count('id', distinct=True))
            )
        }
    for company in companies:
        company.active_public_job_count = counts.get(company.pk, 0)
    return companies


def _folded_company_search_q(field, text):
    """Indexed equivalent of ``unaccent__icontains`` for folded name fields."""
    query = Q()
    for token in fold_accents(text).split():
        query &= Q(**{f'{field}__contains': token})
    return query


def search_companies(text):
    text = (text or '').strip()
    # Không lọc theo trạng thái xác thực: mọi hồ sơ công ty hợp lệ đều có thể
    # được tìm và chọn. Chỉ bỏ placeholder rỗng của luồng đăng ký legacy vì đó
    # không phải một bản ghi catalogue có thể liên kết.
    queryset = _catalog_companies_queryset()
    if text:
        queryset = queryset.filter(
            search_q('company_name', text)
            | search_q('trade_name', text)
            | search_q('tax_code', text)
        )
        ordering = ('company_name', 'id')
    else:
        ordering = ('-created_at', '-id')
    return queryset.prefetch_related('industries').order_by(*ordering)


def public_company_search_queryset(*, query):
    """Return every name-matching company in stable cursor order."""
    query = (query or '').strip()
    queryset = Company.objects.all()
    if query:
        queryset = queryset.filter(
            _folded_company_search_q('company_name_search', query)
            | _folded_company_search_q('trade_name_search', query)
        )
    return _public_company_projection(queryset).order_by('slug')
