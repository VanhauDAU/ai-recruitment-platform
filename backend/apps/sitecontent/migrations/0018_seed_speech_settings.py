from django.db import migrations

SETTINGS = (
    ('speech_enabled', 'Bật hệ thống giọng đọc', 'boolean', False, True),
    ('speech_live_enabled', 'Cho phép tổng hợp giọng đọc trực tiếp', 'boolean', False, True),
    ('speech_blog_enabled', 'Giọng đọc Blog', 'boolean', False, True),
    ('speech_onboarding_enabled', 'Giọng đọc Onboarding', 'boolean', False, True),
    ('speech_chatbot_enabled', 'Giọng đọc Chatbot', 'boolean', False, True),
    ('speech_interview_enabled', 'Giọng đọc Phỏng vấn', 'boolean', False, True),
    (
        'speech_daily_authenticated_limit',
        'Lượt tạo giọng đọc/ngày/tài khoản',
        'number',
        30,
        False,
    ),
    ('speech_daily_anonymous_limit', 'Lượt tạo giọng đọc/ngày/IP', 'number', 30, False),
    ('speech_blog_voice_id', 'Giọng Blog', 'select', 'north-male-natural', False),
    ('speech_blog_style', 'Phong cách Blog', 'select', 'tu_nhien', False),
    (
        'speech_assistant_voice_id',
        'Giọng trợ lý và Onboarding',
        'select',
        'north-female-news',
        False,
    ),
    (
        'speech_assistant_style',
        'Phong cách trợ lý và Onboarding',
        'select',
        'tin_tuc',
        False,
    ),
)

OPTIONS = {
    'speech_blog_voice_id': {
        'choices': [
            {'value': 'north-male-natural', 'label': 'Phạm Tuyên'},
            {'value': 'north-female-news', 'label': 'Mai Anh'},
        ]
    },
    'speech_assistant_voice_id': {
        'choices': [
            {'value': 'north-female-news', 'label': 'Mai Anh'},
            {'value': 'north-male-natural', 'label': 'Phạm Tuyên'},
        ]
    },
    'speech_blog_style': {
        'choices': [
            {'value': 'tu_nhien', 'label': 'Tự nhiên'},
            {'value': 'tin_tuc', 'label': 'Rõ ràng'},
        ]
    },
    'speech_assistant_style': {
        'choices': [
            {'value': 'tin_tuc', 'label': 'Rõ ràng'},
            {'value': 'tu_nhien', 'label': 'Tự nhiên'},
        ]
    },
}


def seed_speech_settings(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    for offset, (key, label, value_type, value, is_public) in enumerate(SETTINGS, start=9):
        setting, created = SiteSetting.objects.get_or_create(
            key=key,
            defaults={
                'group': 'ai',
                'is_public': is_public,
                'label': label,
                'order': offset,
                'options': OPTIONS.get(key, {}),
                'value': value,
                'value_type': value_type,
            },
        )
        if created:
            continue
        updates = {
            'group': 'ai',
            'is_public': is_public,
            'label': label,
            'order': offset,
            'options': OPTIONS.get(key, {}),
            'value_type': value_type,
        }
        changed = []
        for field, next_value in updates.items():
            if getattr(setting, field) != next_value:
                setattr(setting, field, next_value)
                changed.append(field)
        if changed:
            setting.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0017_announcement_revision_visual_theme')]

    operations = [migrations.RunPython(seed_speech_settings, migrations.RunPython.noop)]
