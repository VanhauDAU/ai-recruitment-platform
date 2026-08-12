from django.db import migrations
from django.db.models import F


SETTINGS = (
    (
        'ai_job_generation_enabled',
        'Bật AI tạo tin tuyển dụng',
        'boolean',
        False,
        True,
        {},
        'Soft switch theo use case; hard switch AI_RUNTIME_ENABLED luôn có quyền ưu tiên.',
    ),
    (
        'ai_job_generation_model',
        'Model tạo tin tuyển dụng',
        'select',
        'gemini-3.5-flash-lite',
        False,
        {
            'choices': [
                {'value': 'gemini-3.5-flash-lite', 'label': 'Gemini 3.5 Flash Lite'},
            ]
        },
        'Chỉ chọn model có trong cả allowlist môi trường và allowlist runtime.',
    ),
    (
        'ai_job_generation_model_allowlist',
        'Model allowlist cho tạo tin',
        'json',
        ['gemini-3.5-flash-lite'],
        False,
        {},
        'Chỉ được thu hẹp allowlist cấu hình qua môi trường.',
    ),
    (
        'ai_job_generation_daily_limit',
        'Lượt tạo tin/ngày/nhà tuyển dụng',
        'number',
        10,
        False,
        {},
        'Internal retry không tạo thêm lượt quota.',
    ),
    (
        'ai_job_generation_rollout_percent',
        'Tỷ lệ rollout tạo tin AI (%)',
        'number',
        0,
        False,
        {},
        'Phân bucket ổn định theo công ty; allowlist luôn được xét trước tỷ lệ.',
    ),
    (
        'ai_job_generation_company_allowlist',
        'Công ty allowlist tạo tin AI',
        'json',
        [],
        False,
        {},
        'Danh sách public ID công ty được pilot trước rollout phần trăm.',
    ),
)


def seed_ai_job_generation_settings(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    keys = [row[0] for row in SETTINGS]
    SiteSetting.objects.filter(group='ai', order__gte=9).exclude(key__in=keys).update(
        order=F('order') + len(SETTINGS)
    )
    for offset, (
        key,
        label,
        value_type,
        value,
        is_public,
        options,
        description,
    ) in enumerate(SETTINGS, start=9):
        setting, created = SiteSetting.objects.get_or_create(
            key=key,
            defaults={
                'group': 'ai',
                'is_public': is_public,
                'label': label,
                'order': offset,
                'options': options,
                'value': value,
                'value_type': value_type,
                'description': description,
            },
        )
        if created:
            continue
        updates = {
            'group': 'ai',
            'is_public': is_public,
            'label': label,
            'order': offset,
            'options': options,
            'value_type': value_type,
            'description': description,
        }
        changed = []
        for field, next_value in updates.items():
            if getattr(setting, field) != next_value:
                setattr(setting, field, next_value)
                changed.append(field)
        if changed:
            setting.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0018_seed_speech_settings')]

    operations = [
        migrations.RunPython(seed_ai_job_generation_settings, migrations.RunPython.noop),
    ]
