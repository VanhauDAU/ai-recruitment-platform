"""Content snapshots that let a reviewer compare a revision with the approved one.

An employer edit sends a public job back to the review queue, so moderators need
to know what actually changed instead of re-reading the whole posting. Every
approval stores a snapshot of the content it made public; the pending revision is
diffed against that baseline.
"""

WEEKDAY_LABELS = {
    1: 'Thứ 2',
    2: 'Thứ 3',
    3: 'Thứ 4',
    4: 'Thứ 5',
    5: 'Thứ 6',
    6: 'Thứ 7',
    7: 'Chủ nhật',
}

# key, label, kind (text | date | rich | list), sensitive
SNAPSHOT_FIELDS = (
    ('title', 'Tiêu đề tin', 'text', False),
    ('description', 'Mô tả công việc', 'rich', False),
    ('requirements', 'Yêu cầu ứng viên', 'rich', False),
    ('benefits', 'Quyền lợi', 'rich', False),
    ('salary', 'Thu nhập', 'text', False),
    ('deadline', 'Hạn nhận hồ sơ', 'date', False),
    ('number_of_vacancies', 'Số lượng tuyển', 'text', False),
    ('employment_type', 'Loại hợp đồng', 'text', False),
    ('work_types', 'Hình thức làm việc', 'list', False),
    ('position_level', 'Cấp bậc', 'text', False),
    ('experience_years', 'Kinh nghiệm', 'text', False),
    ('education_level', 'Học vấn', 'text', False),
    ('gender_requirement', 'Giới tính', 'text', False),
    ('age_range', 'Độ tuổi', 'text', False),
    ('categories', 'Chuyên môn', 'list', False),
    ('skills', 'Kỹ năng', 'list', False),
    ('job_benefits', 'Quyền lợi chuẩn hóa', 'list', False),
    ('languages', 'Ngoại ngữ', 'list', False),
    ('locations', 'Địa điểm làm việc', 'list', False),
    ('work_schedules', 'Khung giờ làm việc', 'list', False),
    ('work_schedule_note', 'Ghi chú lịch làm việc', 'text', False),
    ('contact_recipient', 'Người nhận hồ sơ', 'text', True),
    ('contact_phone', 'Điện thoại nhận hồ sơ', 'text', True),
    ('contact_emails', 'Email nhận hồ sơ', 'list', True),
)


def _text(value):
    return (value or '').strip()


def _amount(value):
    if value is None:
        return ''
    return f'{int(value):,}'.replace(',', '.')


def _salary_text(job):
    if not job.salary_type or job.salary_type == job.SalaryType.NEGOTIABLE:
        return 'Thỏa thuận'
    currency = job.currency or job.Currency.VND
    minimum = _amount(job.salary_min)
    maximum = _amount(job.salary_max)
    if minimum and maximum:
        return f'{minimum} – {maximum} {currency}'
    if minimum:
        return f'Từ {minimum} {currency}'
    if maximum:
        return f'Đến {maximum} {currency}'
    return 'Thỏa thuận'


def _age_text(job):
    if job.age_min and job.age_max:
        return f'{job.age_min} – {job.age_max} tuổi'
    if job.age_min:
        return f'Từ {job.age_min} tuổi'
    if job.age_max:
        return f'Đến {job.age_max} tuổi'
    return 'Không yêu cầu'


def _work_type_labels(job):
    labels = dict(job.WorkType.choices)
    values = job.work_types or ([job.work_type] if job.work_type else [])
    return [labels.get(value, value) for value in values if value]


def _location_labels(job):
    labels = []
    for item in job.job_locations.all():
        location = item.location
        province = location.parent.name if location.parent_id else location.name
        label = location.name if location.name == province else f'{location.name}, {province}'
        if item.address_detail:
            label = f'{label} — {item.address_detail}'
        labels.append(label)
    return labels


def _schedule_labels(job):
    labels = []
    for item in job.work_schedules.all():
        parts = []
        if item.weekday_from and item.weekday_to:
            start = WEEKDAY_LABELS.get(item.weekday_from, item.weekday_from)
            end = WEEKDAY_LABELS.get(item.weekday_to, item.weekday_to)
            parts.append(str(start) if item.weekday_from == item.weekday_to else f'{start} - {end}')
        if item.start_time and item.end_time:
            parts.append(f'{item.start_time:%H:%M} - {item.end_time:%H:%M}')
        elif item.start_time:
            parts.append(f'Từ {item.start_time:%H:%M}')
        if item.is_overnight:
            parts.append('qua đêm')
        if item.note:
            parts.append(item.note)
        if parts:
            labels.append(', '.join(parts))
    return labels


def _language_labels(job):
    labels = []
    for item in job.language_requirements.all():
        label = item.language.name
        if item.proficiency_level:
            label = f'{label} — {item.get_proficiency_level_display()}'
        if not item.is_required:
            label = f'{label} (ưu tiên)'
        labels.append(label)
    return labels


def build_job_content_snapshot(job):
    """Freeze the reviewable content of one job into a comparable payload."""
    contact = getattr(job, 'application_contact', None)
    return {
        'title': _text(job.title),
        'description': _text(job.description),
        'requirements': _text(job.requirements),
        'benefits': _text(job.benefits),
        'salary': _salary_text(job),
        'deadline': job.deadline.isoformat() if job.deadline else '',
        'number_of_vacancies': (
            str(job.number_of_vacancies) if job.number_of_vacancies else 'Không giới hạn'
        ),
        'employment_type': job.get_employment_type_display() or '',
        'work_types': _work_type_labels(job),
        'position_level': job.get_position_level_display() or '',
        'experience_years': job.get_experience_years_display() or '',
        'education_level': job.get_education_level_display() or '',
        'gender_requirement': job.get_gender_requirement_display() or '',
        'age_range': _age_text(job),
        'categories': [item.category.name for item in job.category_assignments.all()],
        'skills': [item.skill.name for item in job.job_skills.all()],
        'job_benefits': [item.benefit.name for item in job.job_benefits.all()],
        'languages': _language_labels(job),
        'locations': _location_labels(job),
        'work_schedules': _schedule_labels(job),
        'work_schedule_note': _text(job.work_schedule_note),
        'contact_recipient': _text(contact.recipient_name) if contact else '',
        'contact_phone': _text(contact.phone) if contact else '',
        'contact_emails': ([item.email for item in contact.emails.all()] if contact else []),
    }


def diff_job_snapshots(baseline, current):
    """List the reviewable fields that differ between two snapshots.

    Keys missing from the baseline are skipped: an older snapshot taken before a
    field existed must not be reported as an employer edit.
    """
    changes = []
    for key, label, kind, sensitive in SNAPSHOT_FIELDS:
        if key not in baseline:
            continue
        before = baseline.get(key)
        after = current.get(key)
        if before == after:
            continue
        changes.append(
            {
                'key': key,
                'label': label,
                'kind': kind,
                'sensitive': sensitive,
                'before': before,
                'after': after,
            }
        )
    return changes


def job_pending_changes(job, *, include_sensitive=False):
    """Describe how the revision on screen differs from the approved content."""
    baseline = job.approved_snapshot or {}
    if not baseline:
        return {
            'has_baseline': False,
            'baseline_captured_at': None,
            'changed_count': 0,
            'hidden_sensitive_count': 0,
            'changes': [],
        }
    changes = diff_job_snapshots(baseline, build_job_content_snapshot(job))
    hidden = 0
    if not include_sensitive:
        hidden = sum(1 for change in changes if change['sensitive'])
        changes = [change for change in changes if not change['sensitive']]
    return {
        'has_baseline': True,
        'baseline_captured_at': job.approved_snapshot_at,
        'changed_count': len(changes) + hidden,
        'hidden_sensitive_count': hidden,
        'changes': changes,
    }
