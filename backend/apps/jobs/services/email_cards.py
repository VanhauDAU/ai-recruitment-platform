"""Job cards for HTML emails, shared by the job digest and candidate notices.

Emails are read outside the app, so every URL here is absolute.
"""

from django.conf import settings
from django.utils import timezone

from common.media_storage import media_url_from_value

from ..models import Job


def absolute_url(value):
    """Turn a stored media value or site-relative path into an absolute URL."""
    url = media_url_from_value(value) if value else ''
    if not url:
        return ''
    if url.startswith(('http://', 'https://')):
        return url
    return f'{settings.FRONTEND_URL.rstrip("/")}/{url.lstrip("/")}'


def job_url(job):
    return f'{settings.FRONTEND_URL.rstrip("/")}/viec-lam/{job.slug}'


def salary_text(job):
    if job.salary_type == Job.SalaryType.NEGOTIABLE:
        return 'Thỏa thuận'

    def amount(value):
        if value is None:
            return ''
        if job.currency == Job.Currency.VND:
            return f'{int(value / 1_000_000)} triệu'
        return f'{int(value):,} {job.currency}'

    if job.salary_type == Job.SalaryType.FROM:
        return f'Từ {amount(job.salary_min)}'
    if job.salary_type == Job.SalaryType.UP_TO:
        return f'Đến {amount(job.salary_max)}'
    if job.salary_min == job.salary_max:
        return amount(job.salary_min or job.salary_max)
    return f'{amount(job.salary_min)} - {amount(job.salary_max)}'.strip(' -')


def _province_names(job):
    names = []
    for workplace in job.job_locations.all():
        province = workplace.location.parent or workplace.location
        if province.name not in names:
            names.append(province.name)
    return names


def _badges(job, verified_employer):
    badges = []
    if job.tier == Job.Tier.TOP:
        badges.append('TOP')
    elif job.tier == Job.Tier.FEATURED:
        badges.append('Nổi bật')
    if job.is_hot:
        badges.append('HOT')
    if job.is_urgent:
        badges.append('GẤP')
    if job.has_flash_badge:
        badges.append('Phản hồi nhanh')
    if verified_employer:
        badges.append('Nhà tuyển dụng đã xác thực')
    return badges


def job_email_card(job, *, verified_employer=False):
    """Display values of one job; expects ``company`` and ``job_locations`` loaded."""
    days_left = None
    if job.deadline:
        days_left = max((job.deadline - timezone.localdate()).days, 0)
    return {
        'title': job.title,
        'company_name': job.company.company_name,
        'logo_url': absolute_url(job.company.logo_url),
        'locations': ', '.join(_province_names(job)),
        'salary': salary_text(job),
        'days_left': days_left,
        'badges': _badges(job, verified_employer),
        'url': job_url(job),
    }
