"""Nhập hàng loạt tin tuyển dụng do người vận hành chuẩn bị (dữ liệu demo và tập đánh giá).

Mỗi dòng đi đúng các bước của một tin thật: tạo bản nháp cùng dữ liệu liên quan,
kiểm tra đủ điều kiện đăng rồi đưa lên công khai. Dòng có lỗi được báo nguyên
nhân và không tạo gì. Chạy thử (`apply=False`) thực hiện toàn bộ rồi hoàn tác,
nên báo cáo chạy thử phản ánh đúng những gì lần ghi thật sẽ làm.
"""

import re
from collections import Counter
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from html import escape

from django.db import transaction
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.employers.models import RecruiterProfile
from apps.locations.models import Location
from apps.skills.models import Skill
from apps.skills.selectors import normalize_skill_name, skills_by_names
from apps.skills.services import create_skill
from common.rich_text import sanitize_rich_text

from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobCategory,
    JobCategoryAssignment,
    JobLanguageRequirement,
    JobLocation,
    JobSkill,
    Language,
)
from .lifecycle import job_lifecycle_policy, lifecycle_local_date
from .posting import job_deadline_policy, publish_operator_imported_job

REQUIRED_TEXT_FIELDS = (
    ('code', 'Mã tin'),
    ('title', 'Tiêu đề tin'),
    ('description', 'Mô tả công việc'),
    ('requirements', 'Yêu cầu ứng viên'),
)
MISSING_BENEFITS_TEXT = 'Không nêu trong tin gốc.'
FALLBACK_RECIPIENT_NAME = 'Phòng Tuyển dụng'
FALLBACK_PHONE = '0000000000'
BULLET_PREFIX = re.compile(r'^\s*(?:[-•*+–·▪●]|\d+[.)])\s+')
MILLION = Decimal(1_000_000)
MAX_SALARY_MILLION = 10_000
MAX_ADDRESS_LENGTH = JobLocation._meta.get_field('address_detail').max_length


class RowRejected(Exception):
    """Dòng không nhập được; `messages` là danh sách lý do hiển thị cho người nhập."""

    def __init__(self, messages):
        super().__init__('; '.join(messages))
        self.messages = list(messages)


def _fold(value):
    return ' '.join(str(value or '').split()).casefold()


def _text(row, key):
    return str(row.get(key) or '').strip()


def _names(row, key):
    return [name for name in (str(item).strip() for item in row.get(key) or []) if name]


def rich_text_from_lines(text):
    """Văn bản nhiều dòng → HTML trong allow-list: dòng gạch đầu dòng thành `<li>`."""
    blocks = []
    bullets = []
    for line in str(text or '').splitlines():
        content = line.strip()
        if not content:
            continue
        if BULLET_PREFIX.match(line):
            bullets.append(f'<li>{escape(BULLET_PREFIX.sub("", line).strip())}</li>')
            continue
        if bullets:
            blocks.append(f'<ul>{"".join(bullets)}</ul>')
            bullets = []
        blocks.append(f'<p>{escape(content)}</p>')
    if bullets:
        blocks.append(f'<ul>{"".join(bullets)}</ul>')
    return sanitize_rich_text(''.join(blocks))


class _Lookups:
    """Bảng tra danh mục, nạp một lần cho cả lượt nhập."""

    def __init__(self):
        categories = JobCategory.objects.filter(status=JobCategory.Status.ACTIVE).select_related(
            'parent'
        )
        self.specializations = {}
        self.domains = {}
        for category in categories:
            if category.category_type == JobCategory.CategoryType.SPECIALIZATION:
                self.specializations.setdefault(_fold(category.name), category)
            elif category.category_type == JobCategory.CategoryType.DOMAIN:
                self.domains.setdefault(_fold(category.name), category)
        self.provinces = {
            _fold(location.name): location
            for location in Location.objects.filter(level=Location.Level.PROVINCE, is_active=True)
        }
        self.languages = {
            _fold(language.name): language for language in Language.objects.filter(is_active=True)
        }
        # Tin chỉ hiển thị công khai khi người đăng là recruiter đang hoạt động của
        # chính công ty đó (xem `publicly_available_job_filter`).
        self.publishers = list(
            RecruiterProfile.objects.filter(
                company__isnull=False,
                user__status='active',
                user__is_active=True,
                user__is_deleted=False,
            )
            .select_related('user', 'company')
            .order_by('company__company_name', 'pk')
        )
        # Công ty có nhiều recruiter thì tin vào tài khoản chủ công ty trước.
        self.publishers.sort(
            key=lambda recruiter: recruiter.company_role != RecruiterProfile.CompanyRole.OWNER
        )
        self.publishers_by_company = {}
        for recruiter in self.publishers:
            self.publishers_by_company.setdefault(_fold(recruiter.company.company_name), recruiter)
        self.auto_assigned = 0

    def publisher_for(self, company_name):
        if company_name:
            return self.publishers_by_company.get(_fold(company_name))
        recruiter = self.publishers[self.auto_assigned % len(self.publishers)]
        self.auto_assigned += 1
        return recruiter


def _choice(choices, raw, label, errors, *, default=''):
    """Nhận cả nhãn hiển thị lẫn giá trị lưu; trả giá trị lưu."""
    if not str(raw or '').strip():
        if default:
            return default
        errors.append(f'Thiếu "{label}".')
        return ''
    wanted = _fold(raw)
    for value, display in choices:
        if wanted in (_fold(value), _fold(display)):
            return value
    errors.append(f'"{label}" không hợp lệ: {raw}.')
    return ''


def _amount(raw, label, errors):
    if raw in (None, ''):
        return None
    try:
        amount = Decimal(str(raw).replace(',', '.'))
    except InvalidOperation:
        errors.append(f'"{label}" phải là số: {raw}.')
        return None
    if amount <= 0:
        errors.append(f'"{label}" phải lớn hơn 0.')
        return None
    if amount > MAX_SALARY_MILLION:
        errors.append(f'"{label}" tính bằng triệu đồng, giá trị {raw} quá lớn.')
        return None
    return amount * MILLION


def _salary(row, errors):
    minimum = _amount(row.get('salary_min_million'), 'Lương từ', errors)
    maximum = _amount(row.get('salary_max_million'), 'Lương đến', errors)
    if minimum is not None and maximum is not None:
        if maximum < minimum:
            errors.append('"Lương đến" nhỏ hơn "Lương từ".')
        return Job.SalaryType.RANGE, minimum, maximum
    if minimum is not None:
        return Job.SalaryType.FROM, minimum, None
    if maximum is not None:
        return Job.SalaryType.UP_TO, None, maximum
    return Job.SalaryType.NEGOTIABLE, None, None


def _vacancies(row, errors):
    """Số lượng tuyển: nhận "3" hoặc "3 người"; để trống thì là 1."""
    raw = _text(row, 'vacancies')
    if not raw:
        return 1
    digits = re.match(r'\d+', raw)
    if digits is None or int(digits.group()) < 1:
        errors.append(f'"Số lượng tuyển" không hợp lệ: {raw}.')
        return 1
    return int(digits.group())


def _address_detail(row, warnings):
    address = ' '.join(_text(row, 'address_detail').split())
    if len(address) > MAX_ADDRESS_LENGTH:
        warnings.append(f'Địa chỉ làm việc dài quá {MAX_ADDRESS_LENGTH} ký tự nên đã bị cắt.')
        address = address[: MAX_ADDRESS_LENGTH - 1].rstrip() + '…'
    return address


def _language_requirements(row, lookups, errors):
    requirements = []
    for item in row.get('languages') or []:
        name = str(item.get('language') or '').strip()
        if not name:
            continue
        language = lookups.languages.get(_fold(name))
        if language is None:
            errors.append(f'Ngoại ngữ chưa có trong hệ thống: {name}.')
            continue
        level = _choice(
            JobLanguageRequirement._meta.get_field('proficiency_level').choices,
            item.get('level'),
            f'Mức {name}',
            errors,
            default='conversational',
        )
        requirements.append(
            {
                'language': language,
                'proficiency_level': level,
                'certificate': str(item.get('certificate') or '').strip(),
                'is_required': bool(item.get('required', True)),
            }
        )
    return requirements


def _resolve(row, lookups):
    """Đối chiếu một dòng với danh mục; gom mọi lỗi của dòng rồi mới từ chối."""
    errors = []
    warnings = []
    for key, label in REQUIRED_TEXT_FIELDS:
        if not _text(row, key):
            errors.append(f'Thiếu "{label}".')

    specialization = lookups.specializations.get(_fold(row.get('specialization')))
    if specialization is None:
        missing = _text(row, 'specialization') or _text(row, 'specialization_other')
        errors.append(
            f'Vị trí chuyên môn chưa có trong danh mục: {missing}.'
            if missing
            else 'Thiếu "Vị trí chuyên môn".'
        )

    domains = []
    for name in _names(row, 'domains'):
        domain = lookups.domains.get(_fold(name))
        if domain is None:
            errors.append(f'Kiến thức chuyên ngành chưa có trong danh mục: {name}.')
        elif domain not in domains:
            domains.append(domain)
    parent = getattr(specialization, 'parent', None)
    if not domains and parent and parent.category_type == JobCategory.CategoryType.DOMAIN:
        domains.append(parent)

    province = lookups.provinces.get(_fold(row.get('province')))
    if province is None:
        errors.append(f'Tỉnh/thành không hợp lệ: {_text(row, "province") or "(trống)"}.')

    recruiter = None
    if not lookups.publishers:
        errors.append('Hệ thống chưa có tài khoản nhà tuyển dụng nào gắn với công ty.')
    else:
        recruiter = lookups.publisher_for(_text(row, 'company'))
        if recruiter is None:
            errors.append(
                f'Công ty demo không tồn tại hoặc không có người đăng: {_text(row, "company")}.'
            )

    salary_type, salary_min, salary_max = _salary(row, errors)
    benefits = _text(row, 'benefits')
    if not benefits:
        benefits = MISSING_BENEFITS_TEXT
        warnings.append('Tin không có mục Quyền lợi; đã ghi "Không nêu trong tin gốc."')

    resolved = {
        'title': _text(row, 'title'),
        'description': rich_text_from_lines(row.get('description')),
        'requirements': rich_text_from_lines(row.get('requirements')),
        'benefits': rich_text_from_lines(benefits),
        'position_level': _choice(
            Job.PositionLevel.choices, row.get('position_level'), 'Cấp bậc', errors
        ),
        'experience_years': _choice(
            Job.ExperienceYears.choices, row.get('experience_years'), 'Kinh nghiệm yêu cầu', errors
        ),
        'education_level': _choice(
            Job.EducationLevel.choices, row.get('education_level'), 'Học vấn yêu cầu', errors
        ),
        'work_type': _choice(
            Job.WorkType.choices, row.get('work_type'), 'Hình thức làm việc', errors
        ),
        'employment_type': _choice(
            Job.EmploymentType.choices, row.get('employment_type'), 'Loại hình', errors
        ),
        'salary_type': salary_type,
        'salary_min': salary_min,
        'salary_max': salary_max,
        'specialization': specialization,
        'domains': domains,
        'province': province,
        'recruiter': recruiter,
        'required_skills': _names(row, 'required_skills'),
        'preferred_skills': _names(row, 'preferred_skills'),
        'languages': _language_requirements(row, lookups, errors),
        'vacancies': _vacancies(row, errors),
        'address_detail': _address_detail(row, warnings),
        'work_schedule_note': _text(row, 'work_schedule_note'),
    }
    if not resolved['required_skills']:
        errors.append('Thiếu "Kỹ năng cần có".')
    if errors:
        raise RowRejected(errors)
    return resolved, warnings


def _create_or_reuse_skill(name):
    """Tạo kỹ năng mới; cách viết khác của kỹ năng đã có (trùng slug) thì dùng lại mục cũ."""
    try:
        skill, _created = create_skill(name)
    except Skill.DoesNotExist:
        skill = Skill.objects.filter(slug=slugify(name)).first()
        if skill is None:
            raise RowRejected([f'Không tạo được kỹ năng: {name}.']) from None
    return skill


def _job_skills(resolved, *, create_missing_skills):
    """(skill, importance) theo thứ tự nhập; kỹ năng trùng giữ mức bắt buộc."""
    ordered = [(name, JobSkill.Importance.REQUIRED) for name in resolved['required_skills']]
    ordered += [(name, JobSkill.Importance.PREFERRED) for name in resolved['preferred_skills']]
    matched = skills_by_names([name for name, _ in ordered])
    missing = [name for name, _ in ordered if normalize_skill_name(name) not in matched]
    if missing and not create_missing_skills:
        raise RowRejected(
            [
                'Kỹ năng chưa có trong danh mục: '
                + ', '.join(dict.fromkeys(missing))
                + '. Rà soát rồi nhập lại với tùy chọn tạo kỹ năng mới.'
            ]
        )
    selected = {}
    for name, importance in ordered:
        skill = matched.get(normalize_skill_name(name))
        if skill is None:
            skill = _create_or_reuse_skill(name)
            matched[normalize_skill_name(name)] = skill
        selected.setdefault(skill.pk, (skill, importance))
    return list(selected.values())


def _create_job(resolved, *, create_missing_skills):
    recruiter = resolved['recruiter']
    user = recruiter.user
    job = Job.objects.create(
        posted_by=user,
        company=recruiter.company,
        title=resolved['title'],
        description=resolved['description'],
        requirements=resolved['requirements'],
        benefits=resolved['benefits'],
        work_type=resolved['work_type'],
        work_types=[resolved['work_type']],
        employment_type=resolved['employment_type'],
        experience_years=resolved['experience_years'],
        position_level=resolved['position_level'],
        education_level=resolved['education_level'],
        salary_type=resolved['salary_type'],
        salary_min=resolved['salary_min'],
        salary_max=resolved['salary_max'],
        number_of_vacancies=resolved['vacancies'],
        work_schedule_note=resolved['work_schedule_note'],
        deadline=lifecycle_local_date()
        + timedelta(days=job_deadline_policy()['max_deadline_days']),
        requested_visibility_days=job_lifecycle_policy()['max_visibility_days'],
        status=Job.Status.DRAFT,
    )
    JobCategoryAssignment.objects.create(
        job=job,
        category=resolved['specialization'],
        role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
    )
    JobCategoryAssignment.objects.bulk_create(
        JobCategoryAssignment(
            job=job,
            category=domain,
            role=JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE,
            sort_order=index,
        )
        for index, domain in enumerate(resolved['domains'])
    )
    JobLocation.objects.create(
        job=job, location=resolved['province'], address_detail=resolved['address_detail']
    )
    JobSkill.objects.bulk_create(
        JobSkill(job=job, skill=skill, importance=importance)
        for skill, importance in _job_skills(resolved, create_missing_skills=create_missing_skills)
    )
    JobLanguageRequirement.objects.bulk_create(
        JobLanguageRequirement(job=job, sort_order=index, **requirement)
        for index, requirement in enumerate(resolved['languages'])
    )
    contact = JobApplicationContact.objects.create(
        job=job,
        recipient_name=user.full_name or FALLBACK_RECIPIENT_NAME,
        phone=recruiter.contact_phone or user.phone or FALLBACK_PHONE,
    )
    JobApplicationEmail.objects.create(contact=contact, email=user.email)
    return publish_operator_imported_job(job, user=user)


def _new_skill_usage(rows):
    """Kỹ năng chưa có trong danh mục → số tin dùng, tính trên mọi dòng kể cả dòng lỗi."""
    names_by_row = [
        dict.fromkeys(_names(row, 'required_skills') + _names(row, 'preferred_skills'))
        for row in rows
    ]
    spelling = {}
    for names in names_by_row:
        for name in names:
            spelling.setdefault(normalize_skill_name(name), name)
    known = skills_by_names(list(spelling.values()))
    usage = Counter(
        key
        for names in names_by_row
        for key in {normalize_skill_name(name) for name in names}
        if key not in known
    )
    return {spelling[key]: count for key, count in sorted(usage.items())}


def _validation_messages(detail):
    if isinstance(detail, dict):
        return [message for value in detail.values() for message in _validation_messages(value)]
    if isinstance(detail, (list, tuple)):
        return [message for value in detail for message in _validation_messages(value)]
    return [str(detail)]


def import_job_postings(rows, *, apply=False, create_missing_skills=False):
    """Nhập danh sách tin; trả báo cáo từng dòng.

    `apply=False` chạy thử rồi hoàn tác mọi thay đổi. Khi chạy thử, kỹ năng chưa
    có trong danh mục luôn được tạo tạm để kiểm tra trọn dòng; khi ghi thật chúng
    chỉ được tạo nếu `create_missing_skills=True`, ngược lại dòng bị từ chối.
    """
    lookups = _Lookups()
    new_skills = _new_skill_usage(rows)
    seen_codes = set()
    entries = []
    allow_new_skills = create_missing_skills or not apply

    with transaction.atomic():
        for row in rows:
            code = _text(row, 'code')
            entry = {
                'code': code,
                'title': _text(row, 'title'),
                'status': 'error',
                'errors': [],
                'warnings': [],
                'job_public_id': '',
                'slug': '',
                'company': '',
            }
            entries.append(entry)
            if code and code in seen_codes:
                entry['errors'].append(f'Mã tin bị trùng trong tệp: {code}.')
                continue
            seen_codes.add(code)
            try:
                with transaction.atomic():
                    resolved, warnings = _resolve(row, lookups)
                    entry['warnings'] = warnings
                    entry['company'] = resolved['recruiter'].company.company_name
                    existing = Job.objects.filter(
                        title=resolved['title'], description=resolved['description']
                    ).first()
                    if existing is not None:
                        entry.update(
                            status='skipped', job_public_id=existing.public_id, slug=existing.slug
                        )
                        continue
                    job = _create_job(resolved, create_missing_skills=allow_new_skills)
                    entry.update(status='imported', job_public_id=job.public_id, slug=job.slug)
            except RowRejected as error:
                entry['errors'] = error.messages
            except ValidationError as error:
                entry['errors'] = _validation_messages(error.detail)
        if not apply:
            transaction.set_rollback(True)

    statuses = Counter(entry['status'] for entry in entries)
    return {
        'applied': apply,
        'rows': entries,
        'new_skills': new_skills,
        'summary': {
            'total': len(entries),
            'imported': statuses['imported'],
            'skipped': statuses['skipped'],
            'errors': statuses['error'],
        },
    }
