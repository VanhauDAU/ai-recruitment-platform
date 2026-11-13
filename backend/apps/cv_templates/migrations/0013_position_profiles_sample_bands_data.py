"""CVT-1b (bước 2): chuyển dữ liệu sang hồ sơ vị trí và nhóm kinh nghiệm.

- mỗi vị trí chuyên môn đang hoạt động có một `CvPositionProfile` (giữ hành vi
  cũ: mọi vị trí đều chọn được khi có nội dung chung);
- nội dung mẫu gắn `job_category` chuyển sang profile tương ứng; cấp độ cũ đổi
  sang nhóm kinh nghiệm (nội dung hiện có mô tả 3 năm kinh nghiệm → `mid`).
  Nội dung gắn vào nhóm ngành hoặc vị trí ngừng hoạt động bị xóa vì ô chọn vị
  trí chưa bao giờ hiển thị được;
- blueprint có `content_json_template` thành nội dung chung (không gắn vị trí,
  giữ token `{position}`).

Tách riêng vì PostgreSQL không cho ALTER TABLE/CREATE INDEX trong cùng
transaction với thay đổi dữ liệu còn trigger FK chờ xử lý.
"""

from django.db import migrations

import common.public_id

LEVEL_TO_BAND = {
    'intern': 'entry',
    'fresher': 'entry',
    'entry': 'entry',
    'junior': 'junior',
    'middle': 'mid',
    'mid': 'mid',
    'senior': 'senior',
    'lead': 'senior',
    'manager': 'senior',
}
DEFAULT_BAND = 'mid'


def forwards(apps, schema_editor):
    JobCategory = apps.get_model('jobs', 'JobCategory')
    CvPositionProfile = apps.get_model('cv_templates', 'CvPositionProfile')
    CvSampleContent = apps.get_model('cv_templates', 'CvSampleContent')
    CvContentBlueprint = apps.get_model('cv_templates', 'CvContentBlueprint')

    profiles = {}
    for category in JobCategory.objects.filter(category_type='specialization', status='active'):
        profiles[category.pk], _ = CvPositionProfile.objects.get_or_create(
            job_category=category,
            defaults={'public_id': common.public_id.generate_public_id('cvpos')},
        )

    seen = set()
    for sample in CvSampleContent.objects.order_by('-status', '-updated_at', 'pk'):
        profile = profiles.get(sample.job_category_id) if sample.job_category_id else None
        if sample.job_category_id and profile is None:
            # Gắn vào nhóm ngành hoặc vị trí ngừng hoạt động: ô chọn vị trí chưa
            # bao giờ hiển thị được nội dung này.
            sample.delete()
            continue
        band = LEVEL_TO_BAND.get(sample.experience_level, DEFAULT_BAND)
        key = (profile.pk if profile else None, sample.locale, band)
        if key in seen:
            sample.delete()
            continue
        seen.add(key)
        sample.position_profile = profile
        sample.experience_band = band
        sample.save(update_fields=['position_profile', 'experience_band'])

    for blueprint in CvContentBlueprint.objects.filter(is_active=True):
        template = blueprint.content_json_template
        band = LEVEL_TO_BAND.get(blueprint.experience_level, DEFAULT_BAND)
        key = (None, blueprint.locale, band)
        if not (isinstance(template, dict) and template.get('sections')) or key in seen:
            continue
        seen.add(key)
        CvSampleContent.objects.create(
            public_id=common.public_id.generate_public_id('cvsample'),
            locale=blueprint.locale,
            experience_band=band,
            title='Nội dung mẫu chung',
            content_json={**template, 'locale': blueprint.locale},
            schema_version=template.get('schema_version') or 1,
            status='published',
        )


class Migration(migrations.Migration):
    dependencies = [
        ('cv_templates', '0012_position_profiles_sample_bands'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
