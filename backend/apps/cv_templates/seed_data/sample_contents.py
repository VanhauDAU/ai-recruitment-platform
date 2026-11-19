"""Seed starter contents: generic per-language/band text with `{position}` tokens and the
positions that get their own copy. Pure data builders for ``seed_cv_catalog``."""

from apps.cv_templates.domain.content_tokens import materialize_tokens
from apps.cv_templates.models import ExperienceBand

from .template_catalog import PALETTE

# The base palette every published template offers; ``seed_cv_templates`` adds the rest.
DEFAULT_COLORS = PALETTE[:5]

# Vị trí chuyên môn có nội dung mẫu riêng (nhóm 3–4 năm). Tên theo ngôn ngữ lấy từ
# `JobCategoryLocalization` do `seed_job_categories` quản lý.
SAMPLE_POSITIONS = [
    'Backend Developer',
    'Frontend Developer',
    'AI/Machine Learning Engineer',
    'Automation Tester',
    'Content Marketing',
    'Nhân viên CSKH',
    'Sales Online',
    'Kế toán tổng hợp',
    'Tuyển dụng',
]

# IT positions put skills right after the summary; other positions keep the
# generic section order.
SKILLS_FIRST_POSITIONS = {
    'Backend Developer',
    'Frontend Developer',
    'AI/Machine Learning Engineer',
    'Automation Tester',
}
SKILLS_FIRST_PRESET = [
    {'section_key': 'summary', 'enabled': True},
    {'section_key': 'skills', 'enabled': True},
    {'section_key': 'experience', 'enabled': True},
    {'section_key': 'education', 'enabled': True},
]

LOCALE_TEXTS = {
    'vi-VN': {
        'title': 'CV mẫu {position}',
        'summary_title': 'Mục tiêu nghề nghiệp',
        'experience_title': 'Kinh nghiệm làm việc',
        'exp_company': 'Công ty TNHH ABC',
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
        'experience_title': 'Work experience',
        'exp_company': 'ABC Company Ltd.',
        'education_title': 'Education',
        'edu_degree': 'Bachelor degree in a related field',
        'edu_school': 'Hanoi University',
        'edu_desc': 'Graduated with distinction.',
        'skills_title': 'Skills',
        'skills': ['{position} expertise', 'Teamwork', 'Problem solving', 'Business English'],
    },
}

# Phần thay đổi theo nhóm kinh nghiệm: mục tiêu, chức danh, ngày bắt đầu, mô tả.
BAND_TEXTS = {
    'vi-VN': {
        ExperienceBand.ENTRY: (
            'Sinh viên mới tốt nghiệp, mong muốn bắt đầu sự nghiệp ở vị trí {position}, '
            'học hỏi nhanh và đóng góp cho đội ngũ ngay từ những dự án đầu tiên.',
            'Thực tập sinh {position}',
            '2025-06',
            'Hỗ trợ các nhiệm vụ của vị trí {position} dưới sự hướng dẫn của trưởng nhóm.\n'
            'Hoàn thành tốt các công việc được giao trong kỳ thực tập.',
        ),
        ExperienceBand.JUNIOR: (
            'Có 2 năm kinh nghiệm ở vị trí {position}, mong muốn nâng cao chuyên môn và '
            'đảm nhận các nhiệm vụ có trách nhiệm lớn hơn.',
            '{position}',
            '2024-01',
            'Thực hiện các nhiệm vụ chính của vị trí {position}, phối hợp cùng các phòng ban '
            'để hoàn thành mục tiêu chung.\nĐạt 110% chỉ tiêu công việc trong năm gần nhất.',
        ),
        ExperienceBand.MID: (
            'Có 3 năm kinh nghiệm ở vị trí {position}, mong muốn phát huy chuyên môn và đóng '
            'góp vào sự phát triển của công ty. Mục tiêu trong 2 năm tới là trở thành nhân sự '
            'chủ chốt của đội ngũ.',
            '{position}',
            '2022-03',
            'Đảm nhận các nhiệm vụ chính của vị trí {position}, phối hợp cùng các phòng ban '
            'để hoàn thành mục tiêu chung.\nĐạt 120% chỉ tiêu công việc trong năm gần nhất.',
        ),
        ExperienceBand.SENIOR: (
            'Hơn 6 năm kinh nghiệm ở vị trí {position}, từng dẫn dắt nhóm và xây dựng quy '
            'trình làm việc. Mong muốn đảm nhận vai trò quản lý chuyên môn.',
            'Trưởng nhóm {position}',
            '2019-05',
            'Dẫn dắt nhóm 5 thành viên ở mảng {position}, xây dựng quy trình và đào tạo nhân '
            'sự mới.\nNâng hiệu suất của nhóm thêm 30% trong hai năm.',
        ),
    },
    'en-US': {
        ExperienceBand.ENTRY: (
            'Recent graduate eager to start a career as a {position}, learning fast and '
            'contributing to the team from the very first projects.',
            '{position} Intern',
            '2025-06',
            'Supported {position} tasks under the guidance of the team lead.\n'
            'Completed every assignment of the internship on schedule.',
        ),
        ExperienceBand.JUNIOR: (
            '2 years of experience as a {position}, looking to deepen my expertise and take '
            'on more responsible work.',
            '{position}',
            '2024-01',
            'Delivered the core tasks of the {position} role together with other '
            'departments.\nAchieved 110% of the yearly performance target.',
        ),
        ExperienceBand.MID: (
            '3 years of experience as a {position}, looking to apply my expertise and '
            'contribute to the growth of the company. My goal for the next 2 years is to '
            'become a key member of the team.',
            '{position}',
            '2022-03',
            'Owned the core responsibilities of the {position} role, collaborating across '
            'departments to deliver shared goals.\nAchieved 120% of the yearly performance '
            'target.',
        ),
        ExperienceBand.SENIOR: (
            'Over 6 years of experience as a {position}, leading teams and building working '
            'processes. Looking for a functional management role.',
            'Senior {position}',
            '2019-05',
            'Led a team of 5 in {position} work, built processes and onboarded new hires.\n'
            'Raised team productivity by 30% over two years.',
        ),
    },
}


def rich_text(value):
    blocks = [{'type': 'paragraph', 'text': line} for line in value.split('\n') if line]
    return {'format': 'rich_text_v1', 'content': blocks}


def build_generic_content(locale, band):
    """Nội dung chung theo ngôn ngữ và nhóm kinh nghiệm, giữ token `{position}`."""
    texts = LOCALE_TEXTS[locale]
    summary, role, start_date, description = BAND_TEXTS[locale][band]
    return {
        'schema_version': 1,
        'locale': locale,
        'personal_info': {
            'full_name': '',
            'headline': '{position}',
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
                'items': [{'item_id': 'summary_item_1', 'value': summary}],
            },
            {
                'instance_id': 'experience_1',
                'section_key': 'experience',
                'title': texts['experience_title'],
                'enabled': True,
                'items': [
                    {
                        'item_id': 'experience_item_1',
                        'role': role,
                        'company': texts['exp_company'],
                        'start_date': start_date,
                        'end_date': None,
                        'description': rich_text(description),
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
                    {'item_id': f'skills_item_{index + 1}', 'name': skill, 'level': ''}
                    for index, skill in enumerate(texts['skills'])
                ],
            },
        ],
        'custom_fields': {},
    }


def build_sample_content(locale, position_name, band=ExperienceBand.MID):
    """Nội dung riêng của một vị trí: nội dung chung đã thay tên vị trí."""
    return materialize_tokens(build_generic_content(locale, band), position_name)
