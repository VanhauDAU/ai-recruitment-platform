from django.apps import AppConfig


class EmployersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.employers'

    def ready(self):
        from .signals import receivers  # noqa: F401
