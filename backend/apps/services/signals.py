from django.core.cache import cache
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import ServiceCategory, ServicePackage

PUBLIC_PACKAGES_CACHE_KEY = 'services_public_packages_v1'


@receiver(post_save, sender=ServiceCategory)
@receiver(post_delete, sender=ServiceCategory)
@receiver(post_save, sender=ServicePackage)
@receiver(post_delete, sender=ServicePackage)
def invalidate_public_packages_cache(sender, **kwargs):
    """Xoá cache sau commit để rollback không làm mất bản public còn hợp lệ."""
    transaction.on_commit(lambda: cache.delete(PUBLIC_PACKAGES_CACHE_KEY))
