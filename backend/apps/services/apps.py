from django.apps import AppConfig


class ServicesConfig(AppConfig):
    """Kept only to run the migration that drops the service tables (ADR-0015)."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.services'
    verbose_name = 'Dịch vụ (đã gỡ)'
