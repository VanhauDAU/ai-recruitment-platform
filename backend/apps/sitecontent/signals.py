from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import SiteSetting

PUBLIC_SETTINGS_CACHE_KEY = 'site_settings_public_v2'


@receiver(post_save, sender=SiteSetting)
@receiver(post_delete, sender=SiteSetting)
def invalidate_public_settings_cache(sender, **kwargs):
    """Xoá cache settings công khai khi có thay đổi (kể cả sửa qua Django admin)."""
    cache.delete(PUBLIC_SETTINGS_CACHE_KEY)
