from django.apps import AppConfig


class MatchingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.matching'
    verbose_name = 'Đối sánh ngữ nghĩa CV–JD'

    def ready(self):
        from . import checks  # noqa: F401
        from .signals import receivers  # noqa: F401
