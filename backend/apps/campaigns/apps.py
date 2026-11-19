from django.apps import AppConfig


class CampaignsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.campaigns'
    verbose_name = 'Phân phối và đo lường chiến dịch'

    def ready(self):
        from .signals import receivers  # noqa: F401
