from django.db.models import F
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import Company, CompanyFollow


@receiver(pre_delete, sender=CompanyFollow)
def release_follower_count(sender, instance, **kwargs):
    """The only place ``Company.follower_count`` goes down.

    Unfollowing and the cascade from a hard-deleted candidate account both
    delete through the ORM, which sends this signal inside the transaction of
    the delete itself. Django sends it for every collected instance, even one
    a concurrent transaction already removed, so the row lock decides who
    decrements: the loser waits and then no longer finds the follow.
    """
    if not CompanyFollow.objects.select_for_update().filter(pk=instance.pk).exists():
        return
    # The floor keeps a follow row inserted outside the follow service from
    # tripping the column's >= 0 check and aborting an account deletion.
    Company.objects.filter(pk=instance.company_id, follower_count__gt=0).update(
        follower_count=F('follower_count') - 1
    )
