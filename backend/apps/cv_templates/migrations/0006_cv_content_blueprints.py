from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


BLUEPRINTS = {
    'vi-VN': {
        'summary_title': 'Mục tiêu nghề nghiệp',
        'summary_template': 'Có 3 năm kinh nghiệm ở vị trí {position}, mong muốn phát huy chuyên môn và đóng góp vào sự phát triển của công ty.',
        'experience_title': 'Kinh nghiệm làm việc',
        'experience_company': 'Công ty TNHH ABC',
        'experience_description_template': 'Đảm nhận các nhiệm vụ chính của vị trí {position}, phối hợp cùng các phòng ban để hoàn thành mục tiêu chung.\nĐạt 120% chỉ tiêu công việc trong năm gần nhất.',
        'education_title': 'Học vấn',
        'education_degree': 'Cử nhân chuyên ngành liên quan',
        'education_institution': 'Trường Đại học Hà Nội',
        'education_description': 'Tốt nghiệp loại Giỏi.',
        'skills_title': 'Kỹ năng',
        'skill_templates': ['Kỹ năng chuyên môn {position}', 'Làm việc nhóm', 'Giải quyết vấn đề', 'Tiếng Anh giao tiếp'],
    },
    'en-US': {
        'summary_title': 'Career objective',
        'summary_template': '3 years of experience as a {position}, looking to apply my expertise and contribute to the growth of the company.',
        'experience_title': 'Work experience',
        'experience_company': 'ABC Company Ltd.',
        'experience_description_template': 'Owned the core responsibilities of the {position} role, collaborating across departments to deliver shared goals.\nAchieved 120% of the yearly performance target.',
        'education_title': 'Education',
        'education_degree': 'Bachelor degree in a related field',
        'education_institution': 'Hanoi University',
        'education_description': 'Graduated with distinction.',
        'skills_title': 'Skills',
        'skill_templates': ['{position} expertise', 'Teamwork', 'Problem solving', 'Business English'],
    },
    'ja-JP': {
        'summary_title': 'キャリア目標',
        'summary_template': '{position}として3年の経験があります。専門性を活かし、会社の成長に貢献したいと考えています。',
        'experience_title': '職務経歴',
        'experience_company': 'ABC株式会社',
        'experience_description_template': '{position}の主要業務を担当し、部門横断で協力して目標を達成しました。\n直近年度の目標を120%達成。',
        'education_title': '学歴',
        'education_degree': '関連分野の学士号',
        'education_institution': 'ハノイ大学',
        'education_description': '優秀な成績で卒業。',
        'skills_title': 'スキル',
        'skill_templates': ['{position}の専門スキル', 'チームワーク', '問題解決', 'ビジネス英語'],
    },
    'zh-CN': {
        'summary_title': '职业目标',
        'summary_template': '拥有3年{position}工作经验，希望发挥专业能力，为公司发展贡献力量。',
        'experience_title': '工作经历',
        'experience_company': 'ABC有限公司',
        'experience_description_template': '负责{position}岗位的核心工作，跨部门协作完成共同目标。\n最近一年达成120%的绩效指标。',
        'education_title': '教育背景',
        'education_degree': '相关专业学士学位',
        'education_institution': '河内大学',
        'education_description': '以优异成绩毕业。',
        'skills_title': '技能',
        'skill_templates': ['{position}专业技能', '团队合作', '解决问题', '商务英语'],
    },
}


def seed_blueprints_and_sample_localizations(apps, schema_editor):
    CvContentBlueprint = apps.get_model('cv_templates', 'CvContentBlueprint')
    CvSampleContent = apps.get_model('cv_templates', 'CvSampleContent')
    JobCategoryLocalization = apps.get_model('jobs', 'JobCategoryLocalization')

    for locale, values in BLUEPRINTS.items():
        CvContentBlueprint.objects.get_or_create(
            locale=locale,
            experience_level='unspecified',
            defaults={
                'public_id': f'cvblueprint_default_{locale.lower().replace("-", "_")}',
                **values,
                'is_active': True,
            },
        )

    for sample in CvSampleContent.objects.exclude(job_category_id=None).iterator():
        content = sample.content_json if isinstance(sample.content_json, dict) else {}
        personal_info = content.get('personal_info', {})
        display_name = personal_info.get('headline') if isinstance(personal_info, dict) else None
        if display_name:
            JobCategoryLocalization.objects.get_or_create(
                category_id=sample.job_category_id,
                locale=sample.locale,
                defaults={'display_name': display_name, 'is_active': True},
            )


class Migration(migrations.Migration):

    dependencies = [
        ('cv_templates', '0005_cvsamplecontent_position_name_vi'),
        ('jobs', '0017_jobcategory_public_id_localizations'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CvContentBlueprint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('locale', models.CharField(max_length=16)),
                ('experience_level', models.CharField(default='unspecified', max_length=30)),
                ('summary_title', models.CharField(max_length=255)),
                ('summary_template', models.TextField(help_text='Dùng {position} tại nơi cần chèn tên vị trí đã bản địa hóa.')),
                ('experience_title', models.CharField(max_length=255)),
                ('experience_company', models.CharField(max_length=255)),
                ('experience_description_template', models.TextField(help_text='Dùng {position} tại nơi cần chèn tên vị trí.')),
                ('education_title', models.CharField(max_length=255)),
                ('education_degree', models.CharField(max_length=255)),
                ('education_institution', models.CharField(max_length=255)),
                ('education_description', models.TextField(blank=True)),
                ('skills_title', models.CharField(max_length=255)),
                ('skill_templates', models.JSONField(default=list, help_text='Danh sách chuỗi; có thể dùng {position}.')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_cv_content_blueprints', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['locale', 'experience_level']},
        ),
        migrations.AddConstraint(
            model_name='cvcontentblueprint',
            constraint=models.UniqueConstraint(fields=('locale', 'experience_level'), name='uq_cv_content_blueprint'),
        ),
        migrations.AddConstraint(
            model_name='cvsamplecontent',
            constraint=models.UniqueConstraint(fields=('job_category', 'locale', 'experience_level'), name='uq_cv_sample_position_locale_level'),
        ),
        migrations.RunPython(seed_blueprints_and_sample_localizations, migrations.RunPython.noop),
    ]
