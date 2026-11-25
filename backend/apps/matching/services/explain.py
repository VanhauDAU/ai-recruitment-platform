"""Bước 5 của đối sánh: tóm tắt từng tiêu chí và gợi ý cải thiện CV theo luật.

Mọi câu là mẫu câu điền tham số từ kết quả chấm; không có văn bản do mô hình
sinh ra. Gợi ý chỉ ở dạng "nếu bạn đã có…, hãy ghi rõ": không khuyên thêm kỹ
năng hay số năm mà ứng viên chưa có (kế hoạch mục 6b).

Mỗi gợi ý có `code` cố định để giao diện dịch hoặc đổi câu chữ mà không đổi luật.
"""

from apps.jobs.models import Job, JobLanguageRequirement

from .scoring import GENERIC_CRITERIA

DISCLAIMER = (
    'Kết quả là ước lượng tự động dựa trên nội dung CV và tin tuyển dụng, '
    'không phải quyết định tuyển dụng.'
)
# Ghép vào tóm tắt của học vấn, cấp bậc, ngoại ngữ khi hệ số liên quan nhỏ hơn 1.
RELEVANCE_DISCOUNT_NOTE = (
    'Chuyên môn trong CV khác lĩnh vực của tin nên tiêu chí này chỉ được tính một phần vào '
    'điểm tổng.'
)
MAX_SUGGESTIONS = 6
MAX_LISTED = 3
LANGUAGE_NAMES = {'en': 'tiếng Anh', 'ja': 'tiếng Nhật', 'ko': 'tiếng Hàn', 'zh': 'tiếng Trung', 'fr': 'tiếng Pháp', 'vi': 'tiếng Việt'}  # fmt: skip
EXPERIENCE_LABELS = dict(Job.ExperienceYears.choices)
EDUCATION_LABELS = dict(Job.EducationLevel.choices)
POSITION_LABELS = dict(Job.PositionLevel.choices)
LEVEL_LABELS = dict(JobLanguageRequirement.ProficiencyLevel.choices)
PRIORITY_ORDER = {'high': 0, 'medium': 1, 'low': 2}


def _names(items):
    names = [item['name'] for item in items[:MAX_LISTED]]
    more = len(items) - len(names)
    return ', '.join(names) + (f' và {more} kỹ năng khác' if more > 0 else '')


def _months_text(months):
    if months < 12:
        return f'{months} tháng'
    years, rest = divmod(months, 12)
    return f'{years} năm' + (f' {rest} tháng' if rest else '')


def _summary(component):
    key, status, detail = component['key'], component['status'], component['detail']
    if status == 'not_required':
        return 'Tin không đặt yêu cầu cho tiêu chí này.'
    if status == 'insufficient_data':
        return {
            'skills': 'CV chưa ghi kỹ năng nào trong danh mục.',
            'experience': 'Chưa xác định được thời gian làm việc từ CV.',
            'education': 'CV chưa ghi bậc học.',
            'position_level': 'Chưa xác định được cấp bậc từ chức danh trong CV.',
        }.get(key, 'Chưa đủ dữ liệu.')
    if key == 'skills':
        matched, missing = len(detail['matched']), len(detail['missing'])
        return f'Đáp ứng {matched}/{matched + missing} kỹ năng tin yêu cầu.'
    if key == 'experience':
        parts = []
        if detail['cv_months'] is not None and detail['required_band']:
            parts.append(
                f'CV có khoảng {_months_text(detail["cv_months"])} kinh nghiệm, tin yêu cầu '
                f'{EXPERIENCE_LABELS.get(detail["required_band"], "").lower()}.'
            )
        if detail['relevance_score'] is not None:
            parts.append(
                f'Mức liên quan giữa chuyên môn trong CV và tin: {round(detail["relevance_score"])}/100.'
            )
        return ' '.join(parts)
    if key == 'education':
        if detail['required'] == 'none':
            return 'Tin không yêu cầu bậc học.'
        return (
            f'Tin yêu cầu {EDUCATION_LABELS[detail["required"]].lower()} trở lên, '
            f'CV ghi {EDUCATION_LABELS[detail["cv"]].lower()}.'
        )
    if key == 'position_level':
        return (
            f'Tin tuyển {POSITION_LABELS[detail["required"]].lower()}, chức danh gần nhất trong CV '
            f'tương ứng {POSITION_LABELS[detail["cv"]].lower()}.'
        )
    if key == 'languages':
        missing = detail['missing_required']
        if missing:
            return (
                'CV chưa thể hiện ngoại ngữ bắt buộc: '
                + ', '.join(LANGUAGE_NAMES.get(row['code'], row['code']) for row in missing)
                + '.'
            )
        return 'CV đáp ứng yêu cầu ngoại ngữ của tin.'
    return ''


def _suggestions(result):
    by_key = {component['key']: component for component in result['components']}
    suggestions = []

    def add(code, priority, section, message, **params):
        suggestions.append(
            {
                'code': code,
                'priority': priority,
                'section': section,
                'message': message,
                'params': params,
            }
        )

    required = [skill for skill in result['skills']['missing'] if skill['importance'] == 'required']
    if required:
        add(
            'missing_required_skills',
            'high',
            'skills',
            f'Tin yêu cầu {_names(required)}. Nếu bạn đã có, hãy ghi vào mục kỹ năng và kể một '
            'việc đã làm với kỹ năng đó ở mục kinh nghiệm hoặc dự án.',
            skills=[skill['name'] for skill in required],
        )
    unproven = [skill for skill in result['skills']['matched'] if skill['match_type'] == 'exact' and not skill['evidence']]  # fmt: skip
    if unproven:
        add(
            'skills_without_evidence',
            'medium',
            'experience',
            f'CV có ghi {_names(unproven)} nhưng chưa có câu nào kể việc đã dùng. Thêm một dòng '
            'mô tả cụ thể ở mục kinh nghiệm hoặc dự án.',
            skills=[skill['name'] for skill in unproven],
        )
    unmet = [row['text'] for row in result['requirements'] if row['status'] == 'unmet']
    if unmet:
        add(
            'unmet_requirements',
            'medium',
            'experience',
            f'Chưa thấy CV nói tới: “{unmet[0]}”. Nếu bạn đã đáp ứng, hãy nêu rõ trong CV.',
            requirements=unmet[:MAX_LISTED],
        )
    languages = by_key['languages']['detail'].get('missing_required', [])
    if languages:
        row = languages[0]
        level = f' mức {LEVEL_LABELS[row["level"]].lower()}' if row['level'] else ''
        add(
            'missing_required_language',
            'high',
            'languages',
            f'Tin bắt buộc {LANGUAGE_NAMES.get(row["code"], row["code"])}{level}. Nếu bạn có, hãy ghi '
            'rõ mức độ và chứng chỉ (nếu có) ở mục ngoại ngữ.',
            languages=[item['code'] for item in languages],
        )
    for key, message in (
        ('experience', 'Ghi rõ tháng/năm bắt đầu và kết thúc của từng công việc.'),
        ('education', 'Thêm bậc học và chuyên ngành vào mục học vấn.'),
    ):
        if by_key[key]['status'] == 'insufficient_data':
            add(f'missing_{key}_info', 'medium', key, message)
    if result['flags']['experience_estimated']:
        add(
            'pdf_layout_uncertain',
            'low',
            'experience',
            'Bố cục tệp PDF khiến thời gian làm việc chỉ đọc được gần đúng. CV tạo trên hệ thống '
            'cho kết quả chính xác hơn.',
        )
    if result['flags']['language_mismatch']:
        add(
            'language_mismatch',
            'low',
            'general',
            'CV và tin viết bằng hai ngôn ngữ khác nhau; cân nhắc dùng bản CV cùng ngôn ngữ với tin.',
        )
    suggestions.sort(key=lambda item: PRIORITY_ORDER[item['priority']])
    return suggestions[:MAX_SUGGESTIONS]


def _with_discount_note(component, discounted):
    summary = _summary(component)
    if discounted and component['key'] in GENERIC_CRITERIA and component['score']:
        summary = f'{summary} {RELEVANCE_DISCOUNT_NOTE}'
    return {**component, 'summary': summary}


def explain(result):
    """Thêm `summary` cho từng tiêu chí và danh sách `suggestions` vào kết quả chấm."""
    discounted = result['flags'].get('relevance_discount_applied', False)
    components = [_with_discount_note(component, discounted) for component in result['components']]
    explained = {**result, 'components': components}
    return {**explained, 'suggestions': _suggestions(explained), 'disclaimer': DISCLAIMER}
