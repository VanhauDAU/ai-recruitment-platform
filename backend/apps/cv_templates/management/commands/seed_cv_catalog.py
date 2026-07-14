"""Seed CV Builder catalog data: template color variants + sample contents per position.

Idempotent: color variants are only added when missing; sample contents are
keyed by (job_category, locale) and skipped when already present.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.cv_templates.models import (
    CvSampleContent,
    CvTemplate,
    CvTemplateLocalization,
    CvTemplateSection,
    CvTemplateVersion,
)
from apps.jobs.models import JobCategory

DEFAULT_COLOR_VARIANTS = ['#1f2937', '#334e68', '#5b2333', '#0e7490']

SAMPLE_POSITIONS = [
    'Backend Developer',
    'Frontend Developer',
    'AI/Machine Learning Engineer',
    'Automation Tester',
    'Content Marketing',
    'Chăm sóc khách hàng',
    'Nhân viên kinh doanh',
    'Kế toán',
    'Nhân sự',
]

LOCALE_TEXTS = {
    'vi-VN': {
        'title': 'CV mẫu {position}',
        'summary_title': 'Mục tiêu nghề nghiệp',
        'summary': 'Có 3 năm kinh nghiệm ở vị trí {position}, mong muốn phát huy chuyên môn và đóng góp vào sự phát triển của công ty. Mục tiêu trong 2 năm tới là trở thành nhân sự chủ chốt của đội ngũ.',
        'experience_title': 'Kinh nghiệm làm việc',
        'exp_role': '{position}',
        'exp_company': 'Công ty TNHH ABC',
        'exp_desc': 'Đảm nhận các nhiệm vụ chính của vị trí {position}, phối hợp cùng các phòng ban để hoàn thành mục tiêu chung.\nĐạt 120% chỉ tiêu công việc trong năm gần nhất.',
        'education_title': 'Học vấn',
        'edu_degree': 'Cử nhân chuyên ngành liên quan',
        'edu_school': 'Trường Đại học Hà Nội',
        'edu_desc': 'Tốt nghiệp loại Giỏi.',
        'skills_title': 'Kỹ năng',
        'skills': ['Kỹ năng chuyên môn {position}', 'Làm việc nhóm', 'Giải quyết vấn đề', 'Tiếng Anh giao tiếp'],
    },
    'en-US': {
        'title': 'Sample CV — {position}',
        'summary_title': 'Career objective',
        'summary': '3 years of experience as a {position}, looking to apply my expertise and contribute to the growth of the company. My goal for the next 2 years is to become a key member of the team.',
        'experience_title': 'Work experience',
        'exp_role': '{position}',
        'exp_company': 'ABC Company Ltd.',
        'exp_desc': 'Owned the core responsibilities of the {position} role, collaborating across departments to deliver shared goals.\nAchieved 120% of the yearly performance target.',
        'education_title': 'Education',
        'edu_degree': 'Bachelor degree in a related field',
        'edu_school': 'Hanoi University',
        'edu_desc': 'Graduated with distinction.',
        'skills_title': 'Skills',
        'skills': ['{position} expertise', 'Teamwork', 'Problem solving', 'Business English'],
    },
    'ja-JP': {
        'title': 'サンプルCV — {position}',
        'summary_title': 'キャリア目標',
        'summary': '{position}として3年の経験があります。専門性を活かし、会社の成長に貢献したいと考えています。今後2年でチームの中心メンバーになることを目指します。',
        'experience_title': '職務経歴',
        'exp_role': '{position}',
        'exp_company': 'ABC株式会社',
        'exp_desc': '{position}の主要業務を担当し、部門横断で協力して目標を達成しました。\n直近年度の目標を120%達成。',
        'education_title': '学歴',
        'edu_degree': '関連分野の学士号',
        'edu_school': 'ハノイ大学',
        'edu_desc': '優秀な成績で卒業。',
        'skills_title': 'スキル',
        'skills': ['{position}の専門スキル', 'チームワーク', '問題解決', 'ビジネス英語'],
    },
    'zh-CN': {
        'title': '简历模板 — {position}',
        'summary_title': '职业目标',
        'summary': '拥有3年{position}工作经验，希望发挥专业能力，为公司发展贡献力量。未来两年的目标是成为团队的核心成员。',
        'experience_title': '工作经历',
        'exp_role': '{position}',
        'exp_company': 'ABC有限公司',
        'exp_desc': '负责{position}岗位的核心工作，跨部门协作完成共同目标。\n最近一年达成120%的绩效指标。',
        'education_title': '教育背景',
        'edu_degree': '相关专业学士学位',
        'edu_school': '河内大学',
        'edu_desc': '以优异成绩毕业。',
        'skills_title': '技能',
        'skills': ['{position}专业技能', '团队合作', '解决问题', '商务英语'],
    },
}


def rich_text(value):
    blocks = [{'type': 'paragraph', 'text': line} for line in value.split('\n') if line]
    return {'format': 'rich_text_v1', 'content': blocks}


def build_sample_content(locale, position):
    texts = LOCALE_TEXTS[locale]

    def t(key):
        return texts[key].replace('{position}', position)

    return {
        'schema_version': 1,
        'locale': locale,
        'personal_info': {
            'full_name': '',
            'headline': position,
            'email': '',
            'phone': '',
            'address': '',
            'avatar_asset_id': None,
            'links': [],
        },
        'sections': [
            {
                'instance_id': 'summary_1',
                'section_key': 'summary',
                'title': texts['summary_title'],
                'enabled': True,
                'items': [{'item_id': 'summary_item_1', 'value': t('summary')}],
            },
            {
                'instance_id': 'experience_1',
                'section_key': 'experience',
                'title': texts['experience_title'],
                'enabled': True,
                'items': [{
                    'item_id': 'experience_item_1',
                    'role': t('exp_role'),
                    'company': texts['exp_company'],
                    'start_date': '2022-03',
                    'end_date': None,
                    'description': rich_text(t('exp_desc')),
                }],
            },
            {
                'instance_id': 'education_1',
                'section_key': 'education',
                'title': texts['education_title'],
                'enabled': True,
                'items': [{
                    'item_id': 'education_item_1',
                    'degree': texts['edu_degree'],
                    'institution': texts['edu_school'],
                    'start_date': '2016-09',
                    'end_date': '2020-06',
                    'description': rich_text(texts['edu_desc']),
                }],
            },
            {
                'instance_id': 'skills_1',
                'section_key': 'skills',
                'title': texts['skills_title'],
                'enabled': True,
                'items': [
                    {'item_id': f'skills_item_{index + 1}', 'name': skill.replace('{position}', position), 'level': ''}
                    for index, skill in enumerate(texts['skills'])
                ],
            },
        ],
        'custom_fields': {},
    }


class Command(BaseCommand):
    help = 'Seed CV template color variants and per-position sample contents (idempotent).'

    @transaction.atomic
    def handle(self, *args, **options):
        # Published versions are immutable, so adding color variants means
        # publishing a new version cloned from the current one.
        variants_added = 0
        for template in CvTemplate.objects.filter(
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            current_published_version__isnull=False,
        ):
            version = template.current_published_version
            style = dict(version.default_style_json or {})
            if style.get('color_variants'):
                continue
            theme = style.get('theme_color', '#00A66A')
            style['color_variants'] = [color for color in DEFAULT_COLOR_VARIANTS if color != theme]
            latest_number = template.versions.order_by('-version_number').first().version_number
            new_version = CvTemplateVersion.objects.create(
                template=template,
                version_number=latest_number + 1,
                version_status=CvTemplateVersion.VersionStatus.DRAFT,
                renderer_key=version.renderer_key,
                renderer_version=version.renderer_version,
                schema_version=version.schema_version,
                layout_schema=version.layout_schema,
                style_schema=version.style_schema,
                default_layout_json=version.default_layout_json,
                default_style_json=style,
                capabilities=version.capabilities,
                content_contract=version.content_contract,
            )
            for section in version.sections.all():
                CvTemplateSection.objects.create(
                    template_version=new_version,
                    section_definition=section.section_definition,
                    region_key=section.region_key,
                    default_order=section.default_order,
                    is_required=section.is_required,
                    is_default_enabled=section.is_default_enabled,
                    is_draggable=section.is_draggable,
                    use_theme_color=section.use_theme_color,
                    config_json=section.config_json,
                )
            new_version.version_status = CvTemplateVersion.VersionStatus.PUBLISHED
            new_version.published_at = timezone.now()
            new_version.save(update_fields=['version_status', 'published_at'])
            template.current_published_version = new_version
            template.save(update_fields=['current_published_version'])
            variants_added += 1

        # A template only appears in a language catalog when it has an active
        # localization for that locale, so make sure every published template
        # is available in all four supported languages.
        localizations_created = 0
        for template in CvTemplate.objects.filter(
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            current_published_version__isnull=False,
        ):
            base = template.localizations.filter(is_active=True).first()
            for locale in LOCALE_TEXTS:
                _, created = CvTemplateLocalization.objects.get_or_create(
                    template=template,
                    locale=locale,
                    defaults={
                        'display_name': base.display_name if base else template.name,
                        'description': base.description if base else template.description,
                        'is_active': True,
                    },
                )
                localizations_created += int(created)

        samples_created = 0
        categories = {
            category.name: category
            for category in JobCategory.objects.filter(name__in=SAMPLE_POSITIONS)
        }
        for name in SAMPLE_POSITIONS:
            category = categories.get(name)
            if not category:
                self.stdout.write(self.style.WARNING(f'Job category not found, skipped: {name}'))
                continue
            for locale in LOCALE_TEXTS:
                exists = CvSampleContent.objects.filter(job_category=category, locale=locale).exists()
                if exists:
                    continue
                sample = CvSampleContent(
                    job_category=category,
                    locale=locale,
                    title=LOCALE_TEXTS[locale]['title'].replace('{position}', name),
                    content_json=build_sample_content(locale, name),
                    status=CvSampleContent.Status.PUBLISHED,
                    published_at=timezone.now(),
                )
                sample.full_clean()
                sample.save()
                samples_created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done. color_variants added to {variants_added} template version(s); '
            f'{localizations_created} localization(s) and {samples_created} sample content(s) created.'
        ))
