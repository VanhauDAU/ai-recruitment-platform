from django.db import migrations


SECTION_DEFINITIONS = (
    ('summary', 'Giới thiệu', False, False, True, True, False),
    ('experience', 'Kinh nghiệm làm việc', True, True, True, True, False),
    ('education', 'Học vấn', True, True, True, True, False),
    ('skills', 'Kỹ năng', False, True, True, True, False),
    ('projects', 'Dự án', True, True, True, True, False),
    ('certifications', 'Chứng chỉ', True, True, True, True, False),
    ('languages', 'Ngôn ngữ', False, True, True, True, False),
    ('awards', 'Giải thưởng', True, True, True, True, False),
    ('custom', 'Nội dung tùy chỉnh', True, False, True, True, False),
    ('activities', 'Hoạt động', True, True, True, True, False),
    ('references', 'Người tham chiếu', True, True, True, True, False),
    ('interests', 'Sở thích', False, True, True, True, False),
    ('nameplate', 'Danh thiếp', False, False, False, False, True),
    ('contact', 'Thông tin liên hệ', False, False, False, True, True),
    ('avatar', 'Ảnh đại diện', False, False, False, True, True),
)


def seed_wysiwyg_sections(apps, schema_editor):
    CvSectionDefinition = apps.get_model('cv_templates', 'CvSectionDefinition')
    for key, name, allow_multiple, requires_items, initial_item, deletable, personal_info_backed in SECTION_DEFINITIONS:
        CvSectionDefinition.objects.update_or_create(
            section_key=key,
            defaults={
                'display_name': name,
                'data_schema': {
                    'schema_version': 1,
                    'item_id_required': requires_items,
                    'initial_item': initial_item,
                    'deletable': deletable,
                    'personal_info_backed': personal_info_backed,
                },
                'allow_multiple': allow_multiple,
                'is_system': True,
                'is_active': True,
                'schema_version': 1,
            },
        )


class Migration(migrations.Migration):
    dependencies = [('cv_templates', '0008_template_color_snapshot_state')]

    operations = [migrations.RunPython(seed_wysiwyg_sections, migrations.RunPython.noop)]
