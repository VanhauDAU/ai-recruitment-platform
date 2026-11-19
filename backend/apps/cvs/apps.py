from django.apps import AppConfig


class CvsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.cvs'

    def ready(self):
        from .signals import receivers  # noqa: F401
