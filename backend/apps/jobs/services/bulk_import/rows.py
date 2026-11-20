"""Đọc một dòng nhập và đối chiếu với danh mục, gom mọi lỗi của dòng trước khi ghi."""

import re
from decimal import Decimal, InvalidOperation
from html import escape

from apps.employers.models import RecruiterProfile
from apps.employers.services import recruiter_job_publication_state
from apps.locations.models import Location
from common.html.rich_text import sanitize_rich_text

from ...models import Job, JobCategory, JobLanguageRequirement, JobLocation, Language

REQUIRED_TEXT_FIELDS = (
    ('code', 'Mã tin'),
    ('title', 'Tiêu đề tin'),
    ('description', 'Mô tả công việc'),
    ('requirements', 'Yêu cầu ứng viên'),
)
MISSING_BENEFITS_TEXT = 'Không nêu trong tin gốc.'
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


_PROVINCE_PREFIXES = ('thành phố ', 'tỉnh ', 'tp. ', 'tp ')


def _province_key(value):
    """Tên tỉnh/thành bỏ tiền tố hành chính: "Tỉnh Đồng Nai" và "Thành phố Đồng Nai" là một."""
    name = _fold(value)
    for prefix in _PROVINCE_PREFIXES:
        if name.startswith(prefix):
            return name[len(prefix) :]
    return name


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
            _province_key(location.name): location
            for location in Location.objects.filter(level=Location.Level.PROVINCE, is_active=True)
        }
        self.languages = {
            _fold(language.name): language for language in Language.objects.filter(is_active=True)
        }
        # Tin chỉ hiển thị công khai khi người đăng là recruiter đang hoạt động của
        # chính công ty đó, đã được duyệt xác thực và còn DPA hiện hành, tức được
        # mở hồ sơ ứng viên (xem `publicly_available_job_filter`).
        self.publishers = [
            recruiter
            for recruiter in RecruiterProfile.objects.filter(
                company__isnull=False,
                user__status='active',
                user__is_active=True,
                user__is_deleted=False,
            )
            .select_related('user', 'company')
            .order_by('company__company_name', 'pk')
            if not recruiter_job_publication_state(recruiter.user, company_id=recruiter.company_id)[
                'publish_blockers'
            ]
        ]
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

    province = lookups.provinces.get(_province_key(row.get('province')))
    if province is None:
        errors.append(f'Tỉnh/thành không hợp lệ: {_text(row, "province") or "(trống)"}.')

    recruiter = None
    if not lookups.publishers:
        errors.append(
            'Hệ thống chưa có nhà tuyển dụng nào đã xác thực và còn DPA hiện hành để đăng tin.'
        )
    else:
        recruiter = lookups.publisher_for(_text(row, 'company'))
        if recruiter is None:
            errors.append(
                f'Công ty không tồn tại hoặc chưa có người đăng đã xác thực: {_text(row, "company")}.'
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
