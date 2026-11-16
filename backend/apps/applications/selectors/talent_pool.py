"""Read side of the talent pool, including re-matching to a new job."""

from django.db.models import Exists, OuterRef, Q

from apps.jobs.selectors import job_similarity_scores

from ..models import Application, CandidateBlock, TalentPoolEntry, TalentPoolInvitation

MIN_SUGGESTION_SCORE = 20


def recruiter_talent_pool_queryset(recruiter, *, q='', tag=''):
    queryset = (
        TalentPoolEntry.objects.filter(TalentPoolEntry.active_q(), recruiter=recruiter)
        .select_related('candidate', 'source_application__job')
        .order_by('-created_at', '-id')
    )
    if q:
        queryset = queryset.filter(
            Q(candidate__full_name__icontains=q)
            | Q(candidate__email__icontains=q)
            | Q(note__icontains=q)
            | Q(source_application__job__title__icontains=q)
        )
    if tag:
        queryset = queryset.filter(tags__contains=[tag])
    return queryset


def candidate_talent_pool_queryset(candidate):
    return (
        TalentPoolEntry.objects.filter(TalentPoolEntry.active_q(), candidate=candidate)
        .select_related('source_application__job__company')
        .order_by('-created_at', '-id')
    )


def talent_suggestions_for_job(recruiter, job, *, limit=20):
    """Pool members ranked by how close the job they applied to is to ``job``.

    Excludes people who already applied to ``job`` or are blocked; flags those
    already invited. The ranking only compares jobs, never profile data.
    """
    entries = list(
        recruiter_talent_pool_queryset(recruiter)
        .exclude(Exists(Application.objects.filter(job=job, candidate_id=OuterRef('candidate_id'))))
        .exclude(
            Exists(
                CandidateBlock.objects.filter(
                    CandidateBlock.active_q(),
                    company_id=job.company_id,
                    candidate_id=OuterRef('candidate_id'),
                )
            )
        )
        .annotate(
            already_invited=Exists(
                TalentPoolInvitation.objects.filter(entry_id=OuterRef('pk'), job=job)
            )
        )
        .filter(source_application__isnull=False)
    )
    scores = job_similarity_scores(job, [entry.source_application.job_id for entry in entries])
    ranked = []
    for entry in entries:
        score, reasons = scores.get(entry.source_application.job_id, (0, []))
        if score >= MIN_SUGGESTION_SCORE:
            ranked.append({'entry': entry, 'score': score, 'reasons': reasons})
    ranked.sort(key=lambda item: (item['score'], item['entry'].created_at), reverse=True)
    return ranked[:limit]
