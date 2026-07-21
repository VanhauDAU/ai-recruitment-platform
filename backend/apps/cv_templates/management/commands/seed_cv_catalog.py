"""Seed CV Builder taxonomy, template colors and sample contents per position.

Idempotent: relations use get_or_create; sample contents are keyed by
(job_category, locale) and skipped when already present.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.cv_templates.models import (
    CvCategory,
    CvColor,
    CvContentBlueprint,
    CvSampleContent,
    CvTemplate,
    CvTemplateCategoryLink,
    CvTemplateColorLink,
    CvTemplateLocalization,
)
from apps.jobs.models import JobCategory, JobCategoryLocalization

DEFAULT_COLORS = [
    ('Xanh thương hiệu', 'brand-green', '#00A66A'),
    ('Than chì', 'charcoal', '#1F2937'),
    ('Xanh đá', 'slate-blue', '#334E68'),
    ('Đỏ rượu', 'burgundy', '#5B2333'),
    ('Xanh teal', 'teal', '#0E7490'),
]

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

POSITION_LABELS = {
    'vi-VN': {
        'Backend Developer': 'Lập trình viên Backend',
        'Frontend Developer': 'Lập trình viên Frontend',
        'AI/Machine Learning Engineer': 'Kỹ sư AI/Machine Learning',
        'Automation Tester': 'Kiểm thử tự động',
        'Content Marketing': 'Content Marketing',
        'Chăm sóc khách hàng': 'Chăm sóc khách hàng',
        'Nhân viên kinh doanh': 'Nhân viên kinh doanh',
        'Kế toán': 'Kế toán',
        'Nhân sự': 'Nhân sự',
    },
    'en-US': {
        'Backend Developer': 'Backend Developer',
        'Frontend Developer': 'Frontend Developer',
        'AI/Machine Learning Engineer': 'AI/Machine Learning Engineer',
        'Automation Tester': 'Automation Tester',
        'Content Marketing': 'Content Marketing',
        'Chăm sóc khách hàng': 'Customer Service',
        'Nhân viên kinh doanh': 'Sales Executive',
        'Kế toán': 'Accountant',
        'Nhân sự': 'Human Resources',
    },
    'ja-JP': {
        'Backend Developer': 'バックエンド開発者',
        'Frontend Developer': 'フロントエンド開発者',
        'AI/Machine Learning Engineer': 'AI・機械学習エンジニア',
        'Automation Tester': '自動化テスター',
        'Content Marketing': 'コンテンツマーケティング',
        'Chăm sóc khách hàng': 'カスタマーサポート',
        'Nhân viên kinh doanh': '営業担当者',
        'Kế toán': '会計担当者',
        'Nhân sự': '人事担当者',
    },
    'zh-CN': {
        'Backend Developer': '后端开发工程师',
        'Frontend Developer': '前端开发工程师',
        'AI/Machine Learning Engineer': '人工智能/机器学习工程师',
        'Automation Tester': '自动化测试工程师',
        'Content Marketing': '内容营销',
        'Chăm sóc khách hàng': '客户服务专员',
        'Nhân viên kinh doanh': '销售专员',
        'Kế toán': '会计专员',
        'Nhân sự': '人力资源专员',
    },
}

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
        'skills': [
            'Kỹ năng chuyên môn {position}',
            'Làm việc nhóm',
            'Giải quyết vấn đề',
            'Tiếng Anh giao tiếp',
        ],
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


def category_type_for(name):
    return (
        CvCategory.CategoryType.STYLE
        if name.casefold() in {'simple', 'modern', 'classic'}
        else CvCategory.CategoryType.POSITION
    )


def build_sample_content(locale, position):
    texts = LOCALE_TEXTS[locale]
    localized_position = POSITION_LABELS[locale].get(position, position)

    def t(key):
        return texts[key].replace('{position}', localized_position)

    return {
        'schema_version': 1,
        'locale': locale,
        'personal_info': {
            'full_name': '',
            'headline': localized_position,
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
                'items': [
                    {
                        'item_id': 'experience_item_1',
                        'role': t('exp_role'),
                        'company': texts['exp_company'],
                        'start_date': '2022-03',
                        'end_date': None,
                        'description': rich_text(t('exp_desc')),
                    }
                ],
            },
            {
                'instance_id': 'education_1',
                'section_key': 'education',
                'title': texts['education_title'],
                'enabled': True,
                'items': [
                    {
                        'item_id': 'education_item_1',
                        'degree': texts['edu_degree'],
                        'institution': texts['edu_school'],
                        'start_date': '2016-09',
                        'end_date': '2020-06',
                        'description': rich_text(texts['edu_desc']),
                    }
                ],
            },
            {
                'instance_id': 'skills_1',
                'section_key': 'skills',
                'title': texts['skills_title'],
                'enabled': True,
                'items': [
                    {
                        'item_id': f'skills_item_{index + 1}',
                        'name': skill.replace('{position}', localized_position),
                        'level': '',
                    }
                    for index, skill in enumerate(texts['skills'])
                ],
            },
        ],
        'custom_fields': {},
    }


class Command(BaseCommand):
    help = 'Seed CV template taxonomy, colors and per-position sample contents (idempotent).'

    @transaction.atomic
    def handle(self, *args, **options):
        for category in JobCategory.objects.filter(
            category_type=JobCategory.CategoryType.SPECIALIZATION,
            status=JobCategory.Status.ACTIVE,
        ):
            JobCategoryLocalization.objects.get_or_create(
                category=category,
                locale=JobCategoryLocalization.Locale.VI,
                defaults={'display_name': category.name, 'is_active': True},
            )

        for locale, texts in LOCALE_TEXTS.items():
            CvContentBlueprint.objects.get_or_create(
                locale=locale,
                experience_level='unspecified',
                defaults={
                    'summary_title': texts['summary_title'],
                    'summary_template': texts['summary'],
                    'experience_title': texts['experience_title'],
                    'experience_company': texts['exp_company'],
                    'experience_description_template': texts['exp_desc'],
                    'education_title': texts['education_title'],
                    'education_degree': texts['edu_degree'],
                    'education_institution': texts['edu_school'],
                    'education_description': texts['edu_desc'],
                    'skills_title': texts['skills_title'],
                    'skill_templates': texts['skills'],
                    'is_active': True,
                },
            )

        colors = []
        for index, (name, slug, hex_code) in enumerate(DEFAULT_COLORS):
            color, _ = CvColor.objects.get_or_create(
                hex_code=hex_code,
                defaults={'name': name, 'slug': slug, 'sort_order': index, 'is_active': True},
            )
            colors.append(color)

        color_links_created = 0
        for template in CvTemplate.objects.filter(
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            current_published_version__isnull=False,
        ):
            version = template.current_published_version
            theme = str((version.default_style_json or {}).get('theme_color', '#00A66A')).upper()
            theme_color, _ = CvColor.objects.get_or_create(
                hex_code=theme,
                defaults={
                    'name': f'Màu {theme}',
                    'slug': f'color-{theme.lstrip("#").lower()}',
                },
            )
            ordered_colors = [
                theme_color,
                *[color for color in colors if color.pk != theme_color.pk],
            ]
            has_default = template.color_links.filter(is_default=True).exists()
            for index, color in enumerate(ordered_colors):
                _, created = CvTemplateColorLink.objects.get_or_create(
                    template=template,
                    color=color,
                    defaults={
                        'thumbnail_url': template.thumbnail_url,
                        'preview_url': template.preview_url or template.thumbnail_url,
                        'is_default': index == 0 and not has_default,
                        'sort_order': index,
                    },
                )
                color_links_created += int(created)

            # Convert legacy comma-separated category values into real links.
            for raw_name in filter(None, (part.strip() for part in template.category.split(','))):
                slug = slugify(raw_name)[:140]
                category, _ = CvCategory.objects.get_or_create(
                    category_type=category_type_for(raw_name),
                    slug=slug,
                    defaults={'name': raw_name},
                )
                CvTemplateCategoryLink.objects.get_or_create(template=template, category=category)

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
                localized_position = POSITION_LABELS[locale].get(name, name)
                JobCategoryLocalization.objects.get_or_create(
                    category=category,
                    locale=locale,
                    defaults={'display_name': localized_position, 'is_active': True},
                )
                sample, created = CvSampleContent.objects.get_or_create(
                    job_category=category,
                    locale=locale,
                    defaults={
                        'title': LOCALE_TEXTS[locale]['title'].replace(
                            '{position}', localized_position
                        ),
                        'position_name_vi': POSITION_LABELS['vi-VN'].get(name, name),
                        'content_json': build_sample_content(locale, name),
                        'status': CvSampleContent.Status.PUBLISHED,
                        'published_at': timezone.now(),
                    },
                )
                if created:
                    sample.full_clean()
                    samples_created += 1
                else:
                    # Repair rows generated by the old seed without overwriting
                    # content that an editor has already customized.
                    headline = (sample.content_json or {}).get('personal_info', {}).get('headline')
                    position_name_vi = POSITION_LABELS['vi-VN'].get(name, name)
                    old_position_name_vi = sample.position_name_vi
                    sample.position_name_vi = position_name_vi
                    generated_positions = set(POSITION_LABELS[locale].values()) | {name}
                    generated_headlines = generated_positions
                    generated_titles = {
                        LOCALE_TEXTS[locale]['title'].replace('{position}', generated_position)
                        for generated_position in generated_positions
                    }
                    if headline in generated_headlines and sample.title in generated_titles:
                        sample.title = LOCALE_TEXTS[locale]['title'].replace(
                            '{position}', localized_position
                        )
                        sample.content_json = build_sample_content(locale, name)
                        sample.full_clean()
                        sample.save(
                            update_fields=[
                                'title',
                                'position_name_vi',
                                'content_json',
                                'updated_at',
                            ]
                        )
                    elif old_position_name_vi != position_name_vi:
                        sample.save(update_fields=['position_name_vi', 'updated_at'])

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. {color_links_created} template color link(s) created; '
                f'{localizations_created} localization(s) and {samples_created} sample content(s) created.'
            )
        )
