"""Read site-managed configuration through a small public selector."""

from ..models import SiteSetting


def get_string_setting(key, default=''):
    setting = SiteSetting.objects.filter(key=key).only('value').first()
    value = setting.value if setting else None
    return value if isinstance(value, str) and value.strip() else default
