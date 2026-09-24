from django.db import migrations


SETTING_KEY = 'employer_badge_min_account_months'


def normalize_badge_setting(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    setting = SiteSetting.objects.filter(key=SETTING_KEY).first()
    if setting is None:
        SiteSetting.objects.create(
            key=SETTING_KEY,
            label='Tuổi tài khoản tối thiểu để tin có dấu tick (tháng)',
            group='employer',
            value=6,
            value_type='number',
            options={'integer': True, 'min': 1, 'max': 60, 'step': 1},
            description='Một trong năm điều kiện gắn dấu tick xác thực lên tin tuyển dụng.',
            is_public=False,
        )
        return
    value = setting.value
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 60:
        setting.value = 6
    setting.options = {'integer': True, 'min': 1, 'max': 60, 'step': 1}
    setting.save(update_fields=['value', 'options', 'updated_at'])


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0019_seed_ai_job_generation_settings')]

    operations = [migrations.RunPython(normalize_badge_setting, migrations.RunPython.noop)]
