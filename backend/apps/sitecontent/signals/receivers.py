from django.core.cache import cache
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.sitecontent.models import SiteSetting
from apps.sitecontent.selectors.settings import SETTINGS_CACHE_KEY
from apps.sitecontent.services import PUBLIC_SETTINGS_CACHE_KEY, SEO_SETTINGS_CACHE_KEY

CACHE_KEYS = [SETTINGS_CACHE_KEY, PUBLIC_SETTINGS_CACHE_KEY, SEO_SETTINGS_CACHE_KEY]


@receiver(post_save, sender=SiteSetting)
@receiver(post_delete, sender=SiteSetting)
def invalidate_settings_cache(sender, **kwargs):
    """Xoá cache sau commit để rollback không làm mất bản đã commit còn hợp lệ.

    Code chạy trong transaction không đọc cache (xem ``_stored_values``) nên vẫn
    thấy ngay thay đổi chưa commit của chính nó.
    """
    transaction.on_commit(lambda: cache.delete_many(CACHE_KEYS))
