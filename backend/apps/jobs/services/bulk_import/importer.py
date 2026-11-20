"""Ghi từng dòng đã đối chiếu thành tin công khai, trong một giao dịch có thể hoàn tác."""

from collections import Counter
from datetime import timedelta

from django.db import transaction
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.skills.models import Skill
from apps.skills.selectors import normalize_skill_name, skills_by_names
from apps.skills.services import create_skill
from common.vietnam_time import vietnam_today

from ...models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobCategoryAssignment,
    JobLanguageRequirement,
    JobLocation,
    JobSkill,
)
from ..lifecycle import job_lifecycle_policy
from ..posting import job_deadline_policy, publish_operator_imported_job
from .rows import RowRejected, _Lookups, _names, _resolve, _text

FALLBACK_RECIPIENT_NAME = 'Phòng Tuyển dụng'
FALLBACK_PHONE = '0000000000'


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


def _refresh_job_skills(job, resolved, *, create_missing_skills):
    """Đưa kỹ năng của tin đã có về đúng danh sách của dòng nhập; trả số thay đổi.

    Dùng sau khi sửa danh mục kỹ năng (tách alias, gộp tên): tin nhập trước đó vẫn
    trỏ vào kỹ năng theo danh mục cũ.
    """
    wanted = dict(
        (skill.pk, importance)
        for skill, importance in _job_skills(resolved, create_missing_skills=create_missing_skills)
    )
    current = {row.skill_id: row for row in job.job_skills.all()}
    removed = [row.pk for skill_id, row in current.items() if skill_id not in wanted]
    JobSkill.objects.filter(pk__in=removed).delete()
    added = [
        JobSkill(job=job, skill_id=skill_id, importance=importance)
        for skill_id, importance in wanted.items()
        if skill_id not in current
    ]
    JobSkill.objects.bulk_create(added)
    changed = [
        row
        for skill_id, row in current.items()
        if wanted.get(skill_id, row.importance) != row.importance
    ]
    for row in changed:
        row.importance = wanted[row.skill_id]
    JobSkill.objects.bulk_update(changed, ['importance'])
    if removed or added or changed:
        # Kỹ năng thuộc hồ sơ đối sánh của tin: lưu lại tin để hồ sơ và vector được tính lại.
        job.save(update_fields=['updated_at'])
    return len(removed) + len(added) + len(changed)


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
        deadline=vietnam_today() + timedelta(days=job_deadline_policy()['max_deadline_days']),
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


def import_job_postings(rows, *, apply=False, create_missing_skills=False, refresh_skills=False):
    """Nhập danh sách tin; trả báo cáo từng dòng.

    `refresh_skills=True` còn đồng bộ lại kỹ năng của các tin đã có theo dòng nhập
    (số thay đổi ở `skills_changed` của từng dòng).

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
                        if refresh_skills:
                            entry['skills_changed'] = _refresh_job_skills(
                                existing, resolved, create_missing_skills=allow_new_skills
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
        # Công ty có người đăng đủ điều kiện, để bên gọi biết gán tin vào đâu được.
        'publisher_companies': sorted(
            {recruiter.company.company_name for recruiter in lookups.publishers}
        ),
        'summary': {
            'total': len(entries),
            'imported': statuses['imported'],
            'skipped': statuses['skipped'],
            'errors': statuses['error'],
        },
    }
