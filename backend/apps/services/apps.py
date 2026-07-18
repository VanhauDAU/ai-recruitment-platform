from django.apps import AppConfig


class ServicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.services'
    verbose_name = 'Dịch vụ & báo giá NTD'

    def ready(self):
        from . import signals  # noqa: F401
