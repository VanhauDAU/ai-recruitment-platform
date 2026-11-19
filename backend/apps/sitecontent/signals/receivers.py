from django.core.cache import cache
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.sitecontent.models import SiteSetting
from apps.sitecontent.services import PUBLIC_SETTINGS_CACHE_KEY, SEO_SETTINGS_CACHE_KEY


@receiver(post_save, sender=SiteSetting)
@receiver(post_delete, sender=SiteSetting)
def invalidate_public_settings_cache(sender, **kwargs):
    """Xoá cache sau commit để rollback không làm mất bản public còn hợp lệ."""
    transaction.on_commit(
        lambda: cache.delete_many([PUBLIC_SETTINGS_CACHE_KEY, SEO_SETTINGS_CACHE_KEY])
    )
