"""Write-side commands for candidates following a company."""

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from ..models import Company, CompanyFollow


@transaction.atomic
def follow_company(*, company, candidate, notify_new_jobs=None):
    """Follow ``company``; repeating the call only updates the email switch.

    ``notify_new_jobs=None`` keeps the stored choice, or turns the emails on
    for a first follow.
    """
    follow, created = CompanyFollow.objects.get_or_create(
        candidate=candidate,
        company=company,
        defaults={'notify_new_jobs': notify_new_jobs is not False},
    )
    if created:
        # QuerySet.update() on purpose: Company.save() would move updated_at,
        # the optimistic-lock base of open company update requests.
        Company.objects.filter(pk=company.pk).update(follower_count=F('follower_count') + 1)
    elif notify_new_jobs is not None and follow.notify_new_jobs != notify_new_jobs:
        changes = {'notify_new_jobs': notify_new_jobs}
        if notify_new_jobs:
            # Turning emails back on starts a new window: nothing published
            # while they were off is sent afterwards.
            changes['notify_since'] = timezone.now()
        CompanyFollow.objects.filter(pk=follow.pk).update(**changes)


@transaction.atomic
def unfollow_company(*, company, candidate):
    """Drop the follow if there is one; the pre_delete receiver in
    ``employers.signals`` lowers ``Company.follower_count`` in this transaction."""
    CompanyFollow.objects.filter(candidate=candidate, company=company).delete()
