import hashlib
import json
import re
import unicodedata
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.accounts.services import lock_account_for_write
from apps.locations.models import Location
from common.db.search import fold_accents

from ..models import CandidateJobDigestSchedule, JobAlert, JobAlertCategory, JobCategory
from ..models.alert_queries import category_leaf_coverage_ids

JOB_ALERT_LIMIT = 5
DELIVERY_TIME_ZONE = ZoneInfo('Asia/Ho_Chi_Minh')
DELIVERY_HOUR = 8

CRITERIA_FIELDS = (
    'keyword',
    'keyword_scope',
    'province',
    'ward',
    'salary_bucket',
    'experience_years',
    'work_type',
    'employment_type',
)
OPTIONAL_CHAR_FIELDS = (
    'salary_bucket',
    'experience_years',
    'work_type',
    'employment_type',
)


def _normalized_keyword(value):
    value = unicodedata.normalize('NFKC', str(value or ''))
    return re.sub(r'\s+', ' ', value).strip()


def _fingerprint_value(value):
    if hasattr(value, 'pk'):
        return value.pk
    if isinstance(value, str):
        return fold_accents(value)
    return value


def _category_ids(categories):
    return [category.pk if hasattr(category, 'pk') else int(category) for category in categories]


def _validated_categories(categories):
    categories = list(categories or [])
    category_ids = _category_ids(categories)
    if len(category_ids) != len(set(category_ids)):
        raise ValidationError({'category_ids': ['Không được chọn trùng ngành nghề.']})
    active_categories = {
        category.pk: category
        for category in JobCategory.objects.filter(
            pk__in=category_ids,
            status=JobCategory.Status.ACTIVE,
        )
    }
    if set(active_categories) != set(category_ids):
        raise ValidationError({'category_ids': ['Ngành nghề đã chọn không còn hoạt động.']})
    return [active_categories[category_id] for category_id in category_ids]


def _validate_location_pair(province, ward):
    """Validate the merged location state while the owned alert row is locked."""
    if province and (not province.is_active or province.level != Location.Level.PROVINCE):
        raise ValidationError({'province_id': 'Địa điểm này không phải tỉnh/thành.'})
    if ward and (not ward.is_active or ward.level != Location.Level.WARD):
        raise ValidationError({'ward_id': 'Địa điểm này không phải phường/xã.'})
    if ward and not province:
        raise ValidationError({'province_id': 'Cần chọn tỉnh/thành trước khi chọn phường/xã.'})
    if ward and ward.parent_id != province.pk:
        raise ValidationError({'ward_id': 'Phường/xã không thuộc tỉnh/thành đã chọn.'})


def job_alert_fingerprint(values):
    payload = {field: _fingerprint_value(values.get(field)) for field in CRITERIA_FIELDS}
    payload['category_leaf_ids'] = category_leaf_coverage_ids(
        _category_ids(values.get('categories', ()))
    )
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(encoded.encode('utf-8')).hexdigest()


def _refresh_candidate_alert_fingerprints(candidate):
    """Rebase the small owned set when taxonomy descendants have changed."""
    alerts = list(
        JobAlert.objects.select_for_update()
        .filter(candidate=candidate)
        .prefetch_related('categories')
    )
    changed = []
    seen_fingerprints = set()
    for alert in alerts:
        values = {field: getattr(alert, field) for field in CRITERIA_FIELDS}
        values['categories'] = list(alert.categories.all())
        fingerprint = job_alert_fingerprint(values)
        if fingerprint in seen_fingerprints:
            raise _duplicate_error()
        seen_fingerprints.add(fingerprint)
        if fingerprint != alert.criteria_fingerprint:
            alert.criteria_fingerprint = fingerprint
            changed.append(alert)
    JobAlert.objects.bulk_update(changed, ['criteria_fingerprint'])


def next_job_alert_run(now, frequency):
    """Return the next 08:00 Vietnam delivery boundary as an aware UTC datetime."""
    local_now = now.astimezone(DELIVERY_TIME_ZONE)
    if frequency == JobAlert.Frequency.WEEKLY:
        days_until_monday = (7 - local_now.weekday()) % 7
        candidate_date = local_now.date() + timedelta(days=days_until_monday)
        candidate = datetime.combine(
            candidate_date,
            time(hour=DELIVERY_HOUR),
            tzinfo=DELIVERY_TIME_ZONE,
        )
        if candidate <= local_now:
            candidate += timedelta(days=7)
    else:
        candidate = datetime.combine(
            local_now.date(),
            time(hour=DELIVERY_HOUR),
            tzinfo=DELIVERY_TIME_ZONE,
        )
        if candidate <= local_now:
            candidate += timedelta(days=1)
    return candidate.astimezone(ZoneInfo('UTC'))


def _email_verification_error():
    return ValidationError(
        {
            'code': 'email_unverified',
            'detail': 'Hãy xác thực email tài khoản trước khi bật thông báo việc làm.',
        }
    )


def _duplicate_error():
    return ValidationError(
        {
            'code': 'duplicate_alert',
            'detail': 'Bạn đã có một thông báo việc làm với cùng tiêu chí.',
        }
    )


@transaction.atomic
def create_job_alert(user, validated_data):
    locked_user = lock_account_for_write(user)
    if not locked_user.email_verified:
        raise _email_verification_error()
    _refresh_candidate_alert_fingerprints(locked_user)
    if JobAlert.objects.filter(candidate=locked_user).count() >= JOB_ALERT_LIMIT:
        raise ValidationError(
            {
                'code': 'alert_limit_reached',
                'detail': f'Bạn chỉ có thể tạo tối đa {JOB_ALERT_LIMIT} thông báo việc làm.',
            }
        )

    values = dict(validated_data)
    values.setdefault('keyword_scope', JobAlert.KeywordScope.TITLE)
    categories = _validated_categories(values.pop('categories', ()))
    values.setdefault('province', None)
    values.setdefault('ward', None)
    _validate_location_pair(values['province'], values['ward'])
    values.setdefault('frequency', JobAlert.Frequency.DAILY)
    values.setdefault('is_active', True)
    for field in OPTIONAL_CHAR_FIELDS:
        values[field] = values.get(field) or ''
    values['keyword'] = _normalized_keyword(values['keyword'])
    fingerprint = job_alert_fingerprint({**values, 'categories': categories})
    if JobAlert.objects.filter(
        candidate=locked_user,
        criteria_fingerprint=fingerprint,
    ).exists():
        raise _duplicate_error()

    now = timezone.now()
    alert = JobAlert.objects.create(
        candidate=locked_user,
        criteria_fingerprint=fingerprint,
        cursor_at=now,
        next_run_at=next_job_alert_run(now, values['frequency']),
        **values,
    )
    JobAlertCategory.objects.bulk_create(
        [JobAlertCategory(alert=alert, category=category) for category in categories]
    )
    return alert


@transaction.atomic
def update_job_alert(user, alert, validated_data):
    locked_user = lock_account_for_write(user)
    _refresh_candidate_alert_fingerprints(locked_user)
    alert = JobAlert.objects.select_for_update().filter(pk=alert.pk, candidate=locked_user).first()
    if alert is None:
        raise NotFound('Thông báo việc làm không còn tồn tại.')
    enabling = validated_data.get('is_active') is True and not alert.is_active
    if enabling and not locked_user.email_verified:
        raise _email_verification_error()

    validated_data = dict(validated_data)
    categories_supplied = 'categories' in validated_data
    current_categories = list(alert.categories.all())
    categories = (
        _validated_categories(validated_data.pop('categories'))
        if categories_supplied
        else current_categories
    )
    for field in OPTIONAL_CHAR_FIELDS:
        if field in validated_data:
            validated_data[field] = validated_data[field] or ''
    values = {field: getattr(alert, field) for field in CRITERIA_FIELDS}
    values.update({field: value for field, value in validated_data.items() if field in values})
    _validate_location_pair(values['province'], values['ward'])
    values['keyword'] = _normalized_keyword(values['keyword'])
    fingerprint = job_alert_fingerprint({**values, 'categories': categories})
    if (
        JobAlert.objects.filter(
            candidate=locked_user,
            criteria_fingerprint=fingerprint,
        )
        .exclude(pk=alert.pk)
        .exists()
    ):
        raise _duplicate_error()

    criteria_changed = fingerprint != alert.criteria_fingerprint
    state_changed = 'is_active' in validated_data and validated_data['is_active'] != alert.is_active
    frequency_changed = (
        'frequency' in validated_data and validated_data['frequency'] != alert.frequency
    )
    for field, value in validated_data.items():
        setattr(alert, field, value)
    alert.keyword = values['keyword']
    alert.criteria_fingerprint = fingerprint

    update_fields = [*validated_data, 'keyword', 'criteria_fingerprint', 'updated_at']
    if criteria_changed or state_changed:
        now = timezone.now()
        alert.cursor_at = now
        alert.next_run_at = next_job_alert_run(now, alert.frequency)
        update_fields.extend(['cursor_at', 'next_run_at'])
    elif frequency_changed:
        alert.next_run_at = next_job_alert_run(timezone.now(), alert.frequency)
        update_fields.append('next_run_at')
    alert.save(update_fields=list(dict.fromkeys(update_fields)))
    if categories_supplied and set(_category_ids(categories)) != set(
        _category_ids(current_categories)
    ):
        alert.category_links.all().delete()
        JobAlertCategory.objects.bulk_create(
            [JobAlertCategory(alert=alert, category=category) for category in categories]
        )
    return alert


@transaction.atomic
def delete_job_alert(user, alert):
    locked_user = lock_account_for_write(user)
    deleted, _ = JobAlert.objects.filter(pk=alert.pk, candidate=locked_user).delete()
    return bool(deleted)


@transaction.atomic
def reset_candidate_job_delivery_cursors(user, *, configured=False, suitable=False):
    """Start opt-in/resume windows at now so disabled periods never create backlog."""
    locked_user = lock_account_for_write(user)
    now = timezone.now()
    if configured:
        alerts = list(JobAlert.objects.select_for_update().filter(candidate=locked_user))
        for alert in alerts:
            alert.cursor_at = now
            alert.next_run_at = next_job_alert_run(now, alert.frequency)
            alert.updated_at = now
        JobAlert.objects.bulk_update(alerts, ['cursor_at', 'next_run_at', 'updated_at'])
    if suitable:
        CandidateJobDigestSchedule.objects.update_or_create(
            candidate=locked_user,
            defaults={
                'suitable_cursor_at': now,
                'suitable_next_run_at': next_job_alert_run(now, JobAlert.Frequency.WEEKLY),
            },
        )
